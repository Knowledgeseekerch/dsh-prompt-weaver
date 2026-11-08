import { PromptWeaverError } from './errors.js'
import { assertAbort } from './utils.js'

const MAX_OUTPUT_TOKENS = 16000
const TRUNCATION_CODE = 'output-token-cap'
const DEFAULT_CAP = 16000

/** 输出预算上限，可由 config.maxOutputTokensCap 收紧（换用上限更小的模型时）。 */
function capOf(config) {
  const cap = Number.isFinite(config.maxOutputTokensCap) ? config.maxOutputTokensCap : DEFAULT_CAP
  return Math.max(256, Math.min(cap, 32768))
}

/** 按输入长度估算初始输出预算；配置值作为下限，上限取 cap。 */
export function resolveInitialBudget(config, user) {
  const cap = capOf(config)
  const configured = Number.isFinite(config.maxOutputTokens) ? config.maxOutputTokens : 8192
  const estimated = Math.ceil(String(user ?? '').length * 2) + 2000
  return Math.min(Math.max(configured, estimated), cap)
}

/**
 * 总时限自适应：配置值是硬顶，自适应只在顶之下伸缩。
 *
 * 旧版只按草稿字数估时，结果是「一句话的草稿」只拿到 20 秒——而 0.4.0 之后
 * 系统提示词本身已接近一万字符，20 秒连输出都开不了头，正在正常流式返回的
 * 请求会被自己的预算砍掉。耗时由「输入规模 + 期望输出规模」决定，不是草稿字数。
 *
 * 所以：
 * - 输入越长、期望输出越长，预算越大；
 * - 配置的 timeoutMs 是硬顶，自适应不得越过它（想快速失败就把配置调小）；
 * - 真正抓「卡死」的是 idleTimeoutMs，不是这里。
 */
export function resolveAdaptiveTimeout(config, draft, extras = {}) {
  const draftChars = typeof draft?.originalText === 'string' ? draft.originalText.length : 0
  const promptChars = Number.isFinite(extras.promptChars) ? extras.promptChars : draftChars
  // maxResultChars 是输出上限（默认 4 万字符），不是典型输出。按上限估时会让
  // 预算永远顶到硬顶，失去自适应意义；这里按典型增强结果的规模封顶估。
  const outputChars = Number.isFinite(extras.outputChars) ? Math.min(extras.outputChars, 4000) : 4000
  // 30 秒起步；输入每 2k 字符加 5 秒，输出每 1k 字符加 5 秒。取值偏保守：
  // 多等几秒的代价，远小于把一次正常输出判成失败。
  const estimated = 30000 + Math.ceil(promptChars / 2000) * 5000 + Math.ceil(outputChars / 1000) * 5000
  const configured = Number.isFinite(config.timeoutMs) ? config.timeoutMs : 45000
  return Math.min(configured, Math.max(30000, estimated))
}

/**
 * 取消的形态并不统一：原生 AbortController、DOMException(code 20)、
 * 以及各类 SDK 自己包装的 CanceledError / ERR_CANCELED。
 * 只认 'AbortError' 会把其余形态报成 model-failed，用户看到的是「模型失败」，
 * 而实际上是他自己按了取消。
 */
export function isAbortError(error) {
  if (error === undefined || error === null) return false
  const name = String(error.name ?? '')
  if (name === 'AbortError' || name === 'CanceledError' || name === 'CancelledError') return true
  const code = error.code
  if (code === 'ABORT_ERR' || code === 'ERR_CANCELED' || code === 'ERR_ABORTED') return true
  if (name === 'DOMException' && Number(code) === 20) return true
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  return message.includes('operation was aborted') || message.includes('the operation was aborted')
}

export function createDshModelProvider({ ctx, config, session }) {
  return {
    id: 'dsh',
    async complete({ system, user, draft, signal }) {
      assertAbort(signal)
      const llm = ctx.get('llm')
      if (llm === undefined || typeof llm.stream !== 'function') {
        throw new PromptWeaverError('unavailable', 'The llm service is not available.')
      }
      const route = resolveRoute({ ctx, config, session })
      if (route === undefined) {
        throw new PromptWeaverError('no-route', 'No provider/model route is available for this session.')
      }

      const cap = capOf(config)
      // 预算按「提示词规模 + 期望输出规模」估，不再按草稿字数估。
      const promptChars = String(system ?? '').length + String(user ?? '').length
      const outputChars = Number.isFinite(config.maxResultChars) ? config.maxResultChars : 4000
      const budgetMs = resolveAdaptiveTimeout(config, draft, { promptChars, outputChars })
      // 总时限自适应；重试仍共用同一个 deadline，不每轮重新计时。
      const deadline = Date.now() + budgetMs
      let budget = resolveInitialBudget(config, user)

      for (;;) {
        assertAbort(signal)
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          throw new PromptWeaverError(
            'timeout',
            `The enhancement exceeded its ${Math.round(budgetMs / 1000)}s budget (prompt ${promptChars} chars, output up to ${outputChars} chars). `
              + 'A slower model or a longer draft needs a larger config.timeoutMs; a genuinely stuck stream is caught by idleTimeoutMs instead.',
          )
        }
        try {
          return await streamOnce({ llm, route, system, user, budget, config, signal, timeoutMs: remaining })
        } catch (error) {
          // 取消优先于重试：先确认 signal 没被 abort，再判断是否因截断重试。
          assertAbort(signal)
          const truncated = error instanceof PromptWeaverError && error.code === TRUNCATION_CODE
          if (!truncated) throw error
          if (budget >= cap) {
            throw new PromptWeaverError(
              'model-failed',
              `The model hit the output cap even at ${budget} tokens; shorten the draft or raise maxOutputTokensCap.`,
            )
          }
          budget = Math.min(budget * 2, cap)
        }
      }
    },
  }
}

async function streamOnce({ llm, route, system, user, budget, config, signal, timeoutMs }) {
  const timeoutController = new AbortController()
  const abortWith = (message) => {
    const error = new PromptWeaverError('timeout', message)
    error.code = 'timeout'
    timeoutController.abort(error)
  }
  // 两个计时器，各管一件事，缺一不可：
  // 1) 总截止：不重置，兜住「一直在推进但总时长离谱」的情况；
  // 2) 空闲：每次有进展就重置，卡住时比总截止更早断。
  // 只留总截止 → 慢一点的合法请求会被误杀；只留空闲 → 总时长失去上限。
  const deadlineTimer = setTimeout(() => abortWith('The enhancement exceeded its total timeout.'), timeoutMs)
  const idleMs = Math.max(200, Math.min(config.idleTimeoutMs ?? 20000, timeoutMs))
  let idleTimer = null
  const armIdle = (message) => {
    if (idleTimer !== null) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => abortWith(message), idleMs)
  }
  armIdle('The model did not start responding in time.')
  const forwardAbort = () => {
    const error = new PromptWeaverError('aborted', 'The request was cancelled.')
    error.name = 'AbortError'
    timeoutController.abort(error)
  }
  signal?.addEventListener('abort', forwardAbort, { once: true })

  let output = ''
  // 收到过 finish 事件才算「模型说了自己讲完了」。流被掐断时迭代器同样会 done，
  // 只凭 done 判断，会把半截响应当成完整结果写回草稿。
  let sawFinish = false
  try {
    const stream = llm.stream({
      provider: route.provider,
      model: route.model,
      // DSH 的 GenerateOptions.purpose 只接受 'compaction' | 'session-title'；
      // 这里不传，避免超出官方联合类型。
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
      maxTokens: budget,
      temperature: config.temperature,
      signal: timeoutController.signal,
      // 未设置时不带该字段：部分 route 会拒绝显式 effort。
      ...(config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort }),
    })

    const iterator = stream[Symbol.asyncIterator]()
    // 即使 llm.stream 的实现不响应 signal，race 也能让取消立刻返回，而不是等挂起的迭代器。
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => {
        reject(timeoutController.signal.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' }))
      }
      if (timeoutController.signal.aborted) onAbort()
      else timeoutController.signal.addEventListener('abort', onAbort, { once: true })
    })
    aborted.catch(() => {})

    let exhausted = false
    try {
      for (;;) {
        const next = await Promise.race([iterator.next(), aborted])
        if (next.done === true) {
          exhausted = true
          break
        }
        const event = next.value
        // 有任何事件到达就说明还在推进，重置空闲计时。
        armIdle('The model stalled before finishing.')
        if (event?.type === 'text-delta' && typeof event.text === 'string') output += event.text
        if (event?.type === 'finish') {
          sawFinish = true
          // DSH 的正常结束 reason 是 "stop"；max-tokens 表示输出被截断。
          const kind = event.reason?.kind
          if (kind === 'max-tokens') {
            throw new PromptWeaverError(
              TRUNCATION_CODE,
              `The model hit the output token cap at ${budget} tokens.`,
            )
          }
          if (kind !== undefined && kind !== 'stop' && kind !== 'completed') {
            const detail = kind === 'tool-calls'
              ? 'The model tried to call a tool; this provider must return plain text.'
              : `The model finished with status "${kind}".`
            throw new PromptWeaverError('model-failed', detail)
          }
        }
      }
    } finally {
      timeoutController.signal.removeEventListener('abort', onAbort)
      if (!exhausted) {
        // 主动结束底层迭代器；实现若忽略 return() 也只能放弃，race 已经让调用方返回了。
        void Promise.resolve(iterator.return?.()).catch(() => {})
      }
    }
  } catch (error) {
    if (error instanceof PromptWeaverError) throw error
    if (isAbortError(error)) {
      throw timeoutController.signal.reason ?? error
    }
    throw new PromptWeaverError('model-failed', error?.message ?? 'The model request failed.')
  } finally {
    clearTimeout(deadlineTimer)
    if (idleTimer !== null) clearTimeout(idleTimer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  if (output.trim().length === 0) {
    throw new PromptWeaverError('model-failed', 'The model returned an empty response.')
  }
  // 有文本但没有结束事件：流在中途断了。这类半截结果语法上可能恰好完整，
  // 但语义上不保证完整，静默写回等于拿用户的草稿赌一次截断。
  if (!sawFinish) {
    throw new PromptWeaverError(
      'model-failed',
      'The stream ended without a finish event; the response may have been cut off. Retry the enhancement.',
    )
  }
  return { content: output, model: route }
}

export function resolveRoute({ ctx, config, session }) {
  if (config.provider !== undefined && config.model !== undefined) {
    return { provider: config.provider, model: config.model, source: 'config' }
  }
  const header = session?.requestHeader?.()
  if (header?.config?.provider && header?.config?.model) {
    return { provider: header.config.provider, model: header.config.model, source: 'session' }
  }
  const defaults = ctx.get('agentDefaultModel')
  const selection = defaults?.currentSelection?.()
  if (selection?.provider && selection?.model) {
    return { provider: selection.provider, model: selection.model, source: 'default' }
  }
  return undefined
}

export function createStaticModelProvider(outputs) {
  const queue = Array.isArray(outputs) ? [...outputs] : [outputs]
  return {
    id: 'static',
    async complete() {
      const output = queue.shift()
      if (output === undefined) throw new PromptWeaverError('model-failed', 'No static output is available.')
      return { content: output, model: { provider: 'static', model: 'static' } }
    },
  }
}
