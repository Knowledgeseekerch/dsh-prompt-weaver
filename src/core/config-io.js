import { EXPORT_SCHEMA_VERSION } from './constants.js'
import { PromptWeaverError } from './errors.js'
import { readConfig } from './config.js'
import { rejectUnknownKeys, requireObject } from './validate.js'
import { freezeDeep, isPlainObject, stableStringify } from './utils.js'

const EXPORT_KEYS = new Set(['schemaVersion', 'kind', 'preferences', 'frameworks'])

export function exportConfiguration({ config, frameworkStore }) {
  const preferences = {
    mode: config.mode,
    defaultFramework: config.defaultFramework,
    maxIterations: config.maxIterations,
    includeAssistantMessages: config.includeAssistantMessages,
  }
  return freezeDeep({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    kind: 'dsh-prompt-weaver.config',
    preferences,
    frameworks: frameworkStore.exportFrameworks(),
  })
}

export function serializeConfiguration(bundle) {
  return `${stableStringify(bundle)}\n`
}

export function importConfiguration(input, { frameworkStore, conflict = 'error' } = {}) {
  requireObject(input, 'configuration bundle')
  rejectUnknownKeys(input, EXPORT_KEYS, 'configuration bundle')
  if (input.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new PromptWeaverError('invalid-config-bundle', `schemaVersion must be ${EXPORT_SCHEMA_VERSION}.`)
  }
  if (input.kind !== 'dsh-prompt-weaver.config') {
    throw new PromptWeaverError('invalid-config-bundle', 'kind must be "dsh-prompt-weaver.config".')
  }
  const preferences = requireObject(input.preferences ?? {}, 'preferences')
  rejectUnknownKeys(preferences, new Set(['mode', 'defaultFramework', 'maxIterations', 'includeAssistantMessages']), 'preferences')
  const validated = readConfig(preferences)
  const frameworkReport = frameworkStore.importFrameworks(input.frameworks ?? [], { conflict })
  return freezeDeep({
    preferences: {
      mode: validated.mode,
      defaultFramework: validated.defaultFramework,
      maxIterations: validated.maxIterations,
      includeAssistantMessages: validated.includeAssistantMessages,
    },
    frameworks: frameworkReport,
  })
}

export function isConfigurationBundle(value) {
  return isPlainObject(value) && value.kind === 'dsh-prompt-weaver.config' && value.schemaVersion === EXPORT_SCHEMA_VERSION
}
