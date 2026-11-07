import { PromptWeaverError } from './errors.js'

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function freezeDeep(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeDeep))
  }
  if (isPlainObject(value)) {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      result[key] = freezeDeep(item)
    }
    return Object.freeze(result)
  }
  return value
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isPlainObject(value)) {
    const entries = Object.keys(value)
      .filter(key => key !== '__proto__' && key !== 'constructor' && key !== 'prototype')
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function textLength(text) {
  return typeof text === 'string' ? text.length : 0
}

export function truncateText(text, maxLength) {
  if (typeof text !== 'string' || text.length <= maxLength) return text ?? ''
  return `${text.slice(0, maxLength)}…`
}

export function assertAbort(signal) {
  if (signal?.aborted) {
    const error = new PromptWeaverError('aborted', 'The request was cancelled.')
    error.name = 'AbortError'
    throw error
  }
}

export function scriptCounts(text) {
  const counts = { cjk: 0, latin: 0, cyrillic: 0, arabic: 0, devanagari: 0, other: 0 }
  for (const char of String(text ?? '')) {
    const code = char.codePointAt(0) ?? 0
    if (code >= 0x4e00 && code <= 0x9fff) counts.cjk += 1
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) counts.latin += 1
    else if (code >= 0x0400 && code <= 0x04ff) counts.cyrillic += 1
    else if (code >= 0x0600 && code <= 0x06ff) counts.arabic += 1
    else if (code >= 0x0900 && code <= 0x097f) counts.devanagari += 1
    else if (/\p{L}/u.test(char)) counts.other += 1
  }
  return counts
}

export function nowMs() {
  return Date.now()
}

export function elapsedMs(startedAt) {
  return Math.max(0, nowMs() - startedAt)
}

export function compactId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function clampInteger(value, min, max, label) {
  if (!Number.isInteger(value)) {
    throw new PromptWeaverError('invalid-value', `${label} must be an integer.`)
  }
  return Math.min(max, Math.max(min, value))
}
