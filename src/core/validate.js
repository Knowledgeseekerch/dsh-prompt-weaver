import { PromptWeaverError } from './errors.js'
import { isPlainObject, textLength } from './utils.js'

export function requireObject(value, label) {
  if (!isPlainObject(value)) {
    throw new PromptWeaverError('invalid-value', `${label} must be an object.`)
  }
  return value
}

export function requireString(value, label, { minLength = 0, maxLength = Number.MAX_SAFE_INTEGER } = {}) {
  if (typeof value !== 'string') {
    throw new PromptWeaverError('invalid-value', `${label} must be a string.`)
  }
  if (value.length < minLength) {
    throw new PromptWeaverError('invalid-value', `${label} must be at least ${minLength} characters.`)
  }
  if (value.length > maxLength) {
    throw new PromptWeaverError('invalid-value', `${label} must be at most ${maxLength} characters.`)
  }
  return value
}

export function requireEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new PromptWeaverError('invalid-value', `${label} must be one of: ${allowed.join(', ')}.`)
  }
  return value
}

export function requireInteger(value, range, label) {
  const [min, max] = range
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PromptWeaverError(
      'invalid-value',
      `${label} must be an integer between ${min} and ${max}.`,
    )
  }
  return value
}

export function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new PromptWeaverError('invalid-value', `${label} must be a boolean.`)
  }
  return value
}

export function requireFiniteNumber(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new PromptWeaverError('invalid-value', `${label} must be a number between ${min} and ${max}.`)
  }
  return value
}

export function requireLocalizedText(value, label, { maxLength = 300 } = {}) {
  requireObject(value, label)
  const result = {}
  for (const locale of ['zh', 'en']) {
    if (value[locale] === undefined) continue
    result[locale] = requireString(value[locale], `${label}.${locale}`, { maxLength })
  }
  if (Object.keys(result).length === 0) {
    throw new PromptWeaverError('invalid-value', `${label} must define at least "zh" or "en".`)
  }
  return result
}

export function requireBoundedText(value, label, maxLength) {
  requireString(value, label)
  if (textLength(value) > maxLength) {
    throw new PromptWeaverError('invalid-value', `${label} exceeds the ${maxLength} character limit.`)
  }
  return value
}

export function rejectUnknownKeys(value, knownKeys, label) {
  const unknown = Object.keys(value).filter(key => !knownKeys.has(key))
  if (unknown.length > 0) {
    throw new PromptWeaverError('invalid-config', `${label} has unknown key(s): ${unknown.join(', ')}`)
  }
}
