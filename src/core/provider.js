import { PromptWeaverError } from './errors.js'
import { assertAbort } from './utils.js'

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
          maxTokens: config.maxOutputTokens,
          temperature: config.temperature,
          signal: timeoutController.signal,
        })
        for await (const event of stream) {
          if (event?.type === 'text-delta' && typeof event.text === 'string') output += event.text
          if (event?.type === 'finish') {
            const kind = event.reason?.kind
            if (kind !== 'completed') {
              throw new PromptWeaverError('model-failed', `The model finished with status "${kind}".`)
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
    },
  }
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
