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

export function createDshModelProvider({ ctx, config, session }) {
  return {
    id: 'dsh',
    async complete({ system, user, signal }) {
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
      // timeoutMs 是「本次增强的总时限」：重试共用同一个 deadline，而不是每轮重新计时。
      const deadline = Date.now() + config.timeoutMs
      let budget = resolveInitialBudget(config, user)

      for (;;) {
        assertAbort(signal)
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          throw new PromptWeaverError('timeout', `The enhancement exceeded its total timeout of ${config.timeoutMs}ms.`)
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
  const timer = setTimeout(() => {
    const error = new PromptWeaverError('timeout', 'The model request timed out.')
    error.code = 'timeout'
    timeoutController.abort(error)
  }, timeoutMs)
  const forwardAbort = () => {
    const error = new PromptWeaverError('aborted', 'The request was cancelled.')
    error.name = 'AbortError'
    timeoutController.abort(error)
  }
  signal?.addEventListener('abort', forwardAbort, { once: true })

  let output = ''
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
        if (event?.type === 'text-delta' && typeof event.text === 'string') output += event.text
        if (event?.type === 'finish') {
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
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      throw timeoutController.signal.reason ?? error
    }
    throw new PromptWeaverError('model-failed', error?.message ?? 'The model request failed.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }

  if (output.trim().length === 0) {
    throw new PromptWeaverError('model-failed', 'The model returned an empty response.')
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
