import { PromptWeaverError } from './errors.js'
import { safeJsonParse } from './json.js'
import { rejectUnknownKeys, requireObject, requireString } from './validate.js'
import { freezeDeep, isPlainObject } from './utils.js'

const ALLOWED_KEYS = new Set(['enhancedPrompt', 'openQuestions', 'assumptions', 'usedContext'])

export function parseModelOutput(rawOutput, { maxResultChars }) {
  const text = stripJsonFence(String(rawOutput ?? ''))
  let parsed
  try {
    parsed = safeJsonParse(text, 'model output')
  } catch (error) {
    throw new PromptWeaverError('model-output-invalid', `The model did not return valid JSON: ${error.message}`)
  }
  requireObject(parsed, 'model output')
  rejectUnknownKeys(parsed, ALLOWED_KEYS, 'model output')

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

function stripJsonFence(text) {
  let value = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*$/iu.exec(value)
  if (fenced !== null && fenced[1].startsWith('{')) {
    value = fenced[1].trim()
  }
  return value
}

function normalizeQuestions(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new PromptWeaverError('model-output-invalid', 'model output.openQuestions must be an array.')
  }
  if (value.length > 10) {
    throw new PromptWeaverError('model-output-invalid', 'model output.openQuestions cannot contain more than 10 questions.')
  }
  return value.map((question, index) => {
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
  if (!Array.isArray(value) || value.length > maxLength) {
    throw new PromptWeaverError('model-output-invalid', `model output.${label} must be an array of at most ${maxLength} strings.`)
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`, { maxLength: 500 }))
}

export function isPlainModelOutput(value) {
  return isPlainObject(value) && typeof value.enhancedPrompt === 'string'
}
