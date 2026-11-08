import { collectContext } from '../core/context.js'
import { exportConfiguration, importConfiguration } from '../core/config-io.js'
import { MAX_IMPORT_BYTES, SERVICE_NAME } from '../core/constants.js'
import { PromptWeaverError } from '../core/errors.js'
import { normalizeError } from '../core/errors.js'
import { currentScope, runWithScope } from './request-scope.js'

export function createHostService({ ctx, config, frameworkStore, engine, logger }) {
  const service = {
    async enhance(agent, request, signal) {
      try {
        if (agent?.session === undefined) {
          throw new PromptWeaverError('unavailable', 'No live session is attached to this request.')
        }
        // 每个请求在自己的作用域里执行：并发时不会互相覆盖 session。
        return await runWithScope({ agent, session: agent.session }, async () => {
          const result = await engine.enhance(request ?? {}, { signal })
          return { ok: true, ...result }
        })
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
