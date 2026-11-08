import { PromptWeaverError } from './errors.js'
import { safeJsonParse } from './json.js'
import { rejectUnknownKeys, requireObject, requireString } from './validate.js'
import { freezeDeep, isPlainObject } from './utils.js'

const ALLOWED_KEYS = new Set(['enhancedPrompt', 'openQuestions', 'assumptions', 'usedContext'])

export function parseModelOutput(rawOutput, { maxResultChars }) {
  const text = extractJsonObject(String(rawOutput ?? ''))
  let parsed
  try {
    parsed = safeJsonParse(text, 'model output')
  } catch (error) {
    throw new PromptWeaverError('model-output-invalid', `The model did not return valid JSON: ${error.message}`)
  }
  requireObject(parsed, 'model output')
  // 未知字段直接忽略：模型多写一个 notes/reason 之类的键不应让整次增强作废。
  void ALLOWED_KEYS
  void rejectUnknownKeys

  const enhancedPrompt = requireString(parsed.enhancedPrompt, 'model output.enhancedPrompt', { minLength: 1 })
  if (enhancedPrompt.length > maxResultChars) {
    throw new PromptWeaverError('model-output-too-long', `The enhanced prompt exceeds the ${maxResultChars} character limit.`)
  }

  return freezeDeep({
    enhancedPrompt: enhancedPrompt.trim(),
    openQuestions: normalizeQuestions(parsed.openQuestions),
    assumptions: normalizeStringArray(parsed.assumptions, 'assumptions', 10),
    usedContext: normalizeStringArray(parsed.usedContext, 'usedContext', 50),
  })
}

function extractJsonObject(text) {
  let value = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*$/iu.exec(value)
  if (fenced !== null && fenced[1].startsWith('{')) {
    value = fenced[1].trim()
  }
  // 容忍模型在 JSON 前后加了解释：取第一个 { 到最后一个 }。
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start !== -1 && end > start) {
    value = value.slice(start, end + 1)
  }
  return value
}

function normalizeQuestions(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new PromptWeaverError('model-output-invalid', 'model output.openQuestions must be an array.')
  }
  // 超出上限时截断而不是整体失败：前 10 条已经足够驱动澄清。
  const limited = value.length > 10 ? value.slice(0, 10) : value
  return limited.map((question, index) => {
    if (typeof question === 'string') {
      return { question: requireString(question, `openQuestions[${index}]`, { maxLength: 500 }), reason: '' }
    }
    requireObject(question, `openQuestions[${index}]`)
    rejectUnknownKeys(question, new Set(['question', 'reason']), `openQuestions[${index}]`)
    return {
      question: requireString(question.question, `openQuestions[${index}].question`, { maxLength: 500 }),
      reason: question.reason === undefined ? '' : requireString(question.reason, `openQuestions[${index}].reason`, { maxLength: 500 }),
    }
  })
}

function normalizeStringArray(value, label, maxLength) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new PromptWeaverError('model-output-invalid', `model output.${label} must be an array.`)
  }
  // 超量截断，不因模型多列了几条就整体失败。
  return value.slice(0, maxLength).map((item, index) => requireString(item, `${label}[${index}]`, { maxLength: 500 }))
}

export function isPlainModelOutput(value) {
  return isPlainObject(value) && typeof value.enhancedPrompt === 'string'
}
