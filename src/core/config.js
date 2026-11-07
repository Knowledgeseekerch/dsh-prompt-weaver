import {
  CONTEXT_INTEGER_RANGES,
  DEFAULT_CONFIG,
  INTEGER_RANGES,
  MODES,
  PRIVACY_INTEGER_RANGES,
} from './constants.js'
import { PromptWeaverError } from './errors.js'
import { rejectUnknownKeys, requireBoolean, requireEnum, requireInteger, requireFiniteNumber, requireString } from './validate.js'
import { freezeDeep, isPlainObject } from './utils.js'

const TOP_LEVEL_KEYS = new Set([
  'mode',
  'defaultFramework',
  'maxDraftChars',
  'maxResultChars',
  'maxOutputTokens',
  'timeoutMs',
  'temperature',
  'maxIterations',
  'includeAssistantMessages',
  'maxConversationMessages',
  'maxConversationChars',
  'context',
  'privacy',
  'persistFrameworks',
  'frameworksFile',
  'provider',
  'model',
])

const CONTEXT_KEYS = new Set(Object.keys(DEFAULT_CONFIG.context))
const PRIVACY_KEYS = new Set(Object.keys(DEFAULT_CONFIG.privacy))

export function readConfig(input = {}) {
  if (!isPlainObject(input)) {
    throw new PromptWeaverError('invalid-config', 'config must be an object.')
  }
  rejectUnknownKeys(input, TOP_LEVEL_KEYS, 'config')

  if ((input.provider === undefined) !== (input.model === undefined)) {
    throw new PromptWeaverError('invalid-config', 'provider and model must be supplied together.')
  }

  const contextInput = input.context ?? {}
  const privacyInput = input.privacy ?? {}
  if (!isPlainObject(contextInput)) {
    throw new PromptWeaverError('invalid-config', 'config.context must be an object.')
  }
  if (!isPlainObject(privacyInput)) {
    throw new PromptWeaverError('invalid-config', 'config.privacy must be an object.')
  }
  rejectUnknownKeys(contextInput, CONTEXT_KEYS, 'config.context')
  rejectUnknownKeys(privacyInput, PRIVACY_KEYS, 'config.privacy')

  const config = {
    mode: requireEnum(input.mode ?? DEFAULT_CONFIG.mode, MODES, 'config.mode'),
    defaultFramework: requireString(
      input.defaultFramework ?? DEFAULT_CONFIG.defaultFramework,
      'config.defaultFramework',
      { minLength: 1, maxLength: 100 },
    ),
    maxDraftChars: requireInteger(input.maxDraftChars ?? DEFAULT_CONFIG.maxDraftChars, INTEGER_RANGES.maxDraftChars, 'config.maxDraftChars'),
    maxResultChars: requireInteger(input.maxResultChars ?? DEFAULT_CONFIG.maxResultChars, [200, 80000], 'config.maxResultChars'),
    maxOutputTokens: requireInteger(input.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens, INTEGER_RANGES.maxOutputTokens, 'config.maxOutputTokens'),
    timeoutMs: requireInteger(input.timeoutMs ?? DEFAULT_CONFIG.timeoutMs, INTEGER_RANGES.timeoutMs, 'config.timeoutMs'),
    temperature: requireFiniteNumber(input.temperature ?? DEFAULT_CONFIG.temperature, 0, 1, 'config.temperature'),
    maxIterations: requireInteger(input.maxIterations ?? DEFAULT_CONFIG.maxIterations, INTEGER_RANGES.maxIterations, 'config.maxIterations'),
    includeAssistantMessages: requireBoolean(input.includeAssistantMessages ?? DEFAULT_CONFIG.includeAssistantMessages, 'config.includeAssistantMessages'),
    maxConversationMessages: requireInteger(input.maxConversationMessages ?? DEFAULT_CONFIG.maxConversationMessages, INTEGER_RANGES.maxConversationMessages, 'config.maxConversationMessages'),
    maxConversationChars: requireInteger(input.maxConversationChars ?? DEFAULT_CONFIG.maxConversationChars, INTEGER_RANGES.maxConversationChars, 'config.maxConversationChars'),
    context: readNested(contextInput, CONTEXT_KEYS, DEFAULT_CONFIG.context, CONTEXT_INTEGER_RANGES, 'config.context'),
    privacy: readNested(privacyInput, PRIVACY_KEYS, DEFAULT_CONFIG.privacy, PRIVACY_INTEGER_RANGES, 'config.privacy'),
    persistFrameworks: requireBoolean(input.persistFrameworks ?? DEFAULT_CONFIG.persistFrameworks, 'config.persistFrameworks'),
  }

  if (input.frameworksFile !== undefined) {
    config.frameworksFile = requireString(input.frameworksFile, 'config.frameworksFile', { minLength: 1, maxLength: 4096 })
  }
  if (input.provider !== undefined) {
    config.provider = requireString(input.provider, 'config.provider', { minLength: 1, maxLength: 200 })
    config.model = requireString(input.model, 'config.model', { minLength: 1, maxLength: 200 })
  }

  if (config.persistFrameworks && config.frameworksFile === undefined) {
    throw new PromptWeaverError('invalid-config', 'config.frameworksFile is required when persistFrameworks is true.')
  }

  return freezeDeep(config)
}

function readNested(input, keys, defaults, ranges, label) {
  const result = {}
  for (const key of keys) {
    const range = ranges[key]
    const value = input[key] ?? defaults[key]
    if (range === undefined) {
      result[key] = requireBoolean(value, `${label}.${key}`)
    } else {
      result[key] = requireInteger(value, range, `${label}.${key}`)
    }
  }
  return result
}
