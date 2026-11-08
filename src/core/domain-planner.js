import { PromptWeaverError } from './errors.js'
import { safeJsonParse } from './json.js'
import { assertAbort } from './utils.js'

// 领域自举：草稿没命中内置领域时，先让模型回答「这类任务要能执行，
// 执行方必须先答清什么」，再拿这份清单去约束增强主流程。
//
// 分工：内置库负责常见领域（零额外调用、稳定）；自举负责长尾领域（多一次轻量调用）。
// 自举结果只描述「该回答什么」，模型要是写了具体型号/价格，整条丢弃——
// 那等于把猜测钉进提示词，比不补维度更坏。

const PLANNER_SYSTEM = [
  'You plan what a prompt must ask for. You are given a draft request from a user.',
  'List the dimensions a competent executor must answer before this task can actually be carried out.',
  'Return one JSON object and no other text.',
  'JSON schema: {"domain":string,"dimensions":[{"text":string,"slots":[string]}]}.',
  'Rules:',
  '- 3 to 6 dimensions. Fewer if the task is small.',
  '- A dimension is something the executor must ANSWER. Never an answer itself.',
  '- Never name a specific product, model number, price, vendor, file path, or URL. Those are answers, not dimensions.',
  '- Each dimension carries 2 to 4 slots: the concrete sub-items the answer must cover.',
  '- Write "domain", every "text", and every slot in the same language as the draft.',
  '- "domain" is a short lowercase english identifier such as hardware, software, planning.',
  '- Do not include dimensions the draft already answers explicitly.',
].join('\n')

const MAX_DIMENSIONS = 6
const MAX_SLOTS = 4
const MAX_TEXT = 240

export async function resolveDomains({ domains, draft, analysis, provider, config, signal, cache }) {
  if (Array.isArray(domains) && domains.length > 0) return domains
  if (config.autoDomains === false) return []
  if (provider === undefined || provider === null) return []

  const key = cacheKey(draft.originalText)
  const cached = cache?.get(key)
  if (cached !== undefined) return cached

  assertAbort(signal)
  let raw
  try {
    raw = await provider.complete({
      system: PLANNER_SYSTEM,
      user: JSON.stringify({
        draft: draft.originalText,
        taskType: analysis.taskType,
        language: analysis.language.primary,
      }),
      signal,
    })
  } catch (error) {
    // 自举失败不该拖垮整次增强：退回「没有维度」，主流程照常跑。
    if (error instanceof PromptWeaverError && error.code === 'aborted') throw error
    assertAbort(signal)
    return []
  }
  const planned = normalizePlan(raw?.content)
  cache?.set(key, planned)
  return planned
}

export function normalizePlan(content) {
  let parsed
  try {
    parsed = safeJsonParse(String(content ?? '').trim())
  } catch {
    // 模型没按 JSON 回话（比如解释了一段）时不该让整次增强失败。
    return []
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return []
  const dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : []
  const domainId = normalizeDomainId(parsed.domain)
  const kept = []
  for (const entry of dimensions) {
    if (kept.length >= MAX_DIMENSIONS) break
    if (entry === null || typeof entry !== 'object') continue
    const text = typeof entry.text === 'string' ? entry.text.trim() : ''
    if (text.length === 0 || text.length > MAX_TEXT) continue
    // 维度里出现具体型号/价格就是越界，整条丢掉。
    if (namesAnAnswer(text)) continue
    const slots = Array.isArray(entry.slots)
      ? entry.slots
        .filter(slot => typeof slot === 'string')
        .map(slot => slot.trim())
        .filter(slot => slot.length > 0 && slot.length <= 60)
        .slice(0, MAX_SLOTS)
      : []
    if (slots.some(slot => namesAnAnswer(slot))) continue
    kept.push({
      id: `planned-${kept.length + 1}`,
      zh: text,
      en: text,
      slots: { zh: slots, en: slots },
    })
  }
  if (kept.length === 0) return []
  return [{ id: domainId, planned: true, dimensions: kept }]
}

function normalizeDomainId(value) {
  if (typeof value === 'string' && /^[a-z][a-z0-9-]{1,31}$/u.test(value)) return value
  return 'planned'
}

/** 明显是「答案」的写法：具体型号、价格、品牌。 */
const ANSWER_HINTS = [
  /[\p{Script=Latin}]{1,}[-\s]?\d{2,}/u,
  /[¥$€]\s?\d/u,
  /\d+\s*(?:元|块|美元|usd|rmb)/iu,
  /\b(?:stm32|esp32|arduino|raspberry|esp8266|atmega)\b/iu,
]

function namesAnAnswer(text) {
  return ANSWER_HINTS.some(pattern => pattern.test(text))
}

const CACHE_LIMIT = 32

export function createDomainCache() {
  const store = new Map()
  return {
    get(key) {
      return store.get(key)
    },
    set(key, value) {
      if (store.size >= CACHE_LIMIT) {
        const oldest = store.keys().next().value
        store.delete(oldest)
      }
      store.set(key, value)
    },
    get size() {
      return store.size
    },
  }
}

function cacheKey(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim().slice(0, 200).toLowerCase()
}
