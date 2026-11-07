import * as nodeFs from 'node:fs'

import { readConfig } from './src/core/config.js'
import { createFrameworkStore } from './src/core/frameworks.js'
import { createPromptWeaverEngine } from './src/core/engine.js'
import { collectContext } from './src/core/context.js'
import { createDshModelProvider } from './src/core/provider.js'
import { SERVICE_NAME } from './src/core/constants.js'
import { createTypertDescriptor } from './src/host/descriptor.js'
import { createHostService, resolveRoot } from './src/host/service.js'

export { readConfig } from './src/core/config.js'
export { createFrameworkStore } from './src/core/frameworks.js'
export { createPromptWeaverEngine } from './src/core/engine.js'
export { createTypertDescriptor } from './src/host/descriptor.js'
export { createHostService } from './src/host/service.js'
export const DEFAULT_CONFIG = readConfig()

export function apply(ctx, configInput = {}) {
  const config = readConfig(configInput)
  const frameworkStore = createFrameworkStore({
    frameworksFile: config.frameworksFile,
    fs: config.frameworksFile === undefined ? undefined : nodeFs,
  })

  let service
  const provider = {
    id: 'dsh',
    async complete(call) {
      const session = service?.currentAgent?.session
      const dshProvider = createDshModelProvider({ ctx, config, session })
      return dshProvider.complete(call)
    },
  }

  const engine = createPromptWeaverEngine({
    config,
    frameworkStore,
    provider,
    contextProvider: ({ draft, signal }) => collectContext({
      fs: ctx.get('fs'),
      root: resolveRoot(ctx, service?.currentAgent?.session),
      session: service?.currentAgent?.session,
      draft,
      config,
      signal,
    }),
    logger: ctx.logger,
  })

  service = createHostService({
    ctx,
    config,
    frameworkStore,
    engine,
    logger: ctx.logger,
  })

  ctx.provide(SERVICE_NAME, service)
  ctx.inject(['typert'], (typeCtx) => {
    typeCtx.typert.register(createTypertDescriptor())
  })
}
