import { PromptWeaverError } from './errors.js'
import { assertAbort } from './utils.js'

const MAX_OUTPUT_TOKENS = 16000
const TRUNCATION_CODE = 'output-token-cap'

/** 按输入长度估算初始输出预算；配置值作为下限而不是硬上限。 */
export function resolveInitialBudget(config, user) {
  const configured = Number.isFinite(config.maxOutputTokens) ? config.maxOutputTokens : 8192
  const estimated = Math.ceil(String(user ?? '').length * 2) + 2000
  return Math.min(Math.max(configured, estimated), MAX_OUTPUT_TOKENS)
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

      let budget = resolveInitialBudget(config, user)
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await streamOnce({ llm, route, system, user, budget, config, signal })
        } catch (error) {
          const truncated = error instanceof PromptWeaverError && error.code === TRUNCATION_CODE
          if (!truncated || budget >= MAX_OUTPUT_TOKENS) throw error
          // 输出被截断：翻倍预算重试，而不是把半截结果丢掉或直接报错。
          budget = Math.min(budget * 2, MAX_OUTPUT_TOKENS)
        }
      }
      throw new PromptWeaverError(
        'model-failed',
        `The model kept hitting the output token cap even at ${MAX_OUTPUT_TOKENS} tokens; shorten the draft or raise the model limit.`,
      )
    },
  }
}

async function streamOnce({ llm, route, system, user, budget, config, signal }) {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => {
    const error = new PromptWeaverError('timeout', 'The model request timed out.')
    error.code = 'timeout'
    timeoutController.abort(error)
  }, config.timeoutMs)
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
      purpose: 'prompt-weaver',
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
      maxTokens: budget,
      temperature: config.temperature,
      signal: timeoutController.signal,
      // 未设置时不带该字段：部分 route 会拒绝显式 effort。
      ...(config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort }),
    })
    for await (const event of stream) {
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
