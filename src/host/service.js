import { collectContext } from '../core/context.js'
import { exportConfiguration, importConfiguration } from '../core/config-io.js'
import { MAX_IMPORT_BYTES, SERVICE_NAME } from '../core/constants.js'
import { PromptWeaverError } from '../core/errors.js'
import { normalizeError } from '../core/errors.js'
import { currentScope, runWithScope } from './request-scope.js'

const PENDING_TTL_MS = 10 * 60 * 1000
const PENDING_LIMIT = 8

export function createHostService({ ctx, config, frameworkStore, engine, logger }) {
  /** 按 clientKey 暂存尚未被前端取走的增强结果。 */
  const pending = new Map()

  function rememberPending(clientKey, result) {
    pending.set(clientKey, { result, at: Date.now() })
    while (pending.size > PENDING_LIMIT) {
      const oldest = pending.keys().next().value
      pending.delete(oldest)
    }
  }

  const service = {
    async enhance(agent, request, signal) {
      try {
        if (agent?.session === undefined) {
          throw new PromptWeaverError('unavailable', 'No live session is attached to this request.')
        }
        // clientKey 只用于结果暂存，engine 不认识它，先剥掉。
        const clientKey = typeof request?.clientKey === 'string' ? request.clientKey : undefined
        const payload = { ...request }
        delete payload.clientKey

        // 每个请求在自己的作用域里执行：并发时不会互相覆盖 session。
        const outcome = await runWithScope({ agent, session: agent.session }, async () => {
          const result = await engine.enhance(payload, { signal })
          return { ok: true, ...result }
        })

        // 前端组件可能在请求返回前就被卸载（切换会话）。
        // 先存一份，写回成功后由 client 清除；没清除的等下次挂载取回。
        if (clientKey !== undefined && outcome.ok === true) {
          rememberPending(clientKey, outcome)
        }
        return outcome
      } catch (error) {
        const normalized = normalizeError(error)
        logger?.warn?.('dsh-prompt-weaver enhance failed:', normalized.reason)
        return normalized
      }
    },

    async listFrameworks() {
      try {
        return { ok: true, frameworks: frameworkStore.list() }
      } catch (error) {
        const normalized = normalizeError(error)
        logger?.warn?.('dsh-prompt-weaver listFrameworks failed:', normalized.reason)
        return normalized
      }
    },

    async importConfig(agent, request, signal) {
      try {
        if (request === null || typeof request !== 'object') {
          throw new PromptWeaverError('invalid-config-bundle', 'Import payload must be an object.')
        }
        if (JSON.stringify(request).length > MAX_IMPORT_BYTES) {
          throw new PromptWeaverError('import-too-large', `The configuration bundle exceeds the ${MAX_IMPORT_BYTES} byte limit.`)
        }
        const bundle = request.bundle === undefined ? request : request.bundle
        const report = importConfiguration(bundle, {
          frameworkStore,
          conflict: request.conflict === undefined ? 'error' : request.conflict,
        })
        if (config.persistFrameworks && config.frameworksFile !== undefined) {
          frameworkStore.saveFrameworkFile(config.frameworksFile, nodeFileSystem())
        }
        return { ok: true, ...report }
      } catch (error) {
        const normalized = normalizeError(error)
        logger?.warn?.('dsh-prompt-weaver importConfig failed:', normalized.reason)
        return normalized
      }
    },

    async takePending(agent, request) {
      try {
        // descriptor 声明的参数顺序是 (agent, request)；兼容只有一个参数时直接当 request。
        const payload = request ?? agent
        const clientKey = typeof payload?.clientKey === 'string' ? payload.clientKey : undefined
        if (clientKey === undefined) return { ok: true, result: null }
        const entry = pending.get(clientKey)
        if (entry === undefined) return { ok: true, result: null }
        pending.delete(clientKey)
        if (Date.now() - entry.at > PENDING_TTL_MS) return { ok: true, result: null }
        return { ok: true, result: entry.result }
      } catch (error) {
        return normalizeError(error)
      }
    },

    async clearPending(agent, request) {
      try {
        const payload = request ?? agent
        const clientKey = typeof payload?.clientKey === 'string' ? payload.clientKey : undefined
        if (clientKey !== undefined) pending.delete(clientKey)
        return { ok: true }
      } catch (error) {
        return normalizeError(error)
      }
    },

    async exportConfig() {
      try {
        return { ok: true, bundle: exportConfiguration({ config, frameworkStore }) }
      } catch (error) {
        const normalized = normalizeError(error)
        logger?.warn?.('dsh-prompt-weaver exportConfig failed:', normalized.reason)
        return normalized
      }
    },

    contextProvider: ({ draft, signal }) => collectContext({
      fs: ctx.get('fs'),
      root: resolveRoot(ctx, currentScope()?.session),
      session: currentScope()?.session,
      draft,
      config,
      signal,
    }),
  }

  service.typertRemote = Object.freeze({
    service,
    serviceKey: SERVICE_NAME,
    namespace: SERVICE_NAME,
  })

  return service
}

export function resolveRoot(ctx, session) {
  const working = ctx.get('workingDirectory')
  const fromWorking = working?.get?.(session)
  if (typeof fromWorking === 'string' && fromWorking.length > 0) return fromWorking
  const headerCwd = session?.header?.cwd
  if (typeof headerCwd === 'string' && headerCwd.length > 0) return headerCwd
  return undefined
}

function nodeFileSystem() {
  return requireNodeFs()
}

function requireNodeFs() {
  try {
    return globalThis.process?.getBuiltinModule?.('node:fs')
      ?? globalThis.process?.getBuiltinModule?.('fs')
      ?? undefined
  } catch {
    return undefined
  }
}
