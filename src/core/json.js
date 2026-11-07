import { isPlainObject } from './utils.js'

export function safeJsonParse(text, label = 'JSON input') {
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new SyntaxError(`${label} is not valid JSON: ${error.message}`)
  }
  return rejectUnsafeKeys(value, label)
}

function rejectUnsafeKeys(value, label) {
  if (Array.isArray(value)) {
    return value.map(item => rejectUnsafeKeys(item, label))
  }
  if (!isPlainObject(value)) return value
  const clean = Object.create(null)
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new SyntaxError(`${label} contains an unsafe object key: "${key}"`)
    }
    clean[key] = rejectUnsafeKeys(item, label)
  }
  return clean
}

export function readJsonFile(fs, path, label = 'JSON file') {
  const text = fs.readFileSync(path, 'utf8')
  return safeJsonParse(text, label)
}
