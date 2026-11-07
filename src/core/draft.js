import { freezeDeep } from './utils.js'

const PATH_PATTERN = /(?<![\p{L}\p{N}_$])(?:[A-Za-z]:)?(?:[./\\][\p{L}\p{N}_\-.]+|[./\\]|[\p{L}\p{N}_\-]+)[\\/][\p{L}\p{N}_\-./\\]+(?::\d+)?/gu
const MENTION_PATTERN = /(?<![\p{L}\p{N}_$])[@＠][\p{L}\p{N}_\-./\\]+/gu
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`)\]}]+/gu
const CODE_SPAN_PATTERN = /`[^`\n]+`/gu
const VERSION_PATTERN = /(?<![\p{L}\p{N}_$])v?\d+(?:\.\d+){1,3}(?:[-+][\p{L}\p{N}.]+)?(?![\p{L}\p{N}])/gu

export function parseMixedDraft(input) {
  const text = typeof input === 'string' ? input : String(input?.text ?? '')
  const explicitCommand = normalizeExplicitCommand(input?.command, text)
  const candidates = []

  if (explicitCommand !== undefined) {
    candidates.push({
      kind: 'command',
      start: 0,
      end: explicitCommand.length,
      text: explicitCommand,
      priority: 100,
    })
  } else if (/^\/[^\s/]/u.test(text)) {
    const match = /^\/[^\s]+/u.exec(text)
    candidates.push({
      kind: 'command',
      start: 0,
      end: match[0].length,
      text: match[0],
      priority: 100,
    })
  }

  for (const occurrence of Array.isArray(input?.occurrences) ? input.occurrences : []) {
    const clipped = validateOccurrence(occurrence, text)
    if (clipped === undefined) continue
    candidates.push({
      kind: occurrence.appearance === 'session' ? 'session-reference' : 'file-reference',
      start: clipped.start,
      end: clipped.end,
      text: clipped.text,
      label: typeof occurrence.label === 'string' ? occurrence.label : clipped.text,
      source: occurrence.source,
      ref: occurrence.ref,
      priority: 90,
    })
  }

  addMatches(candidates, text, URL_PATTERN, 'url', 80)
  addMatches(candidates, text, CODE_SPAN_PATTERN, 'code', 70)
  addMatches(candidates, text, MENTION_PATTERN, 'file-reference', 60, true)
  addMatches(candidates, text, PATH_PATTERN, 'file-reference', 50, true)
  addMatches(candidates, text, VERSION_PATTERN, 'version', 40)

  const selected = selectNonOverlapping(candidates)
  const segments = toSegments(text, selected)
  const protectedItems = selected.map(item => freezeDeep({
    kind: item.kind,
    text: item.text,
    start: item.start,
    end: item.end,
  }))
  const command = selected.find(item => item.kind === 'command') ?? null
  const naturalText = command === null ? text : text.slice(command.end).trim()
  const attachmentCount = normalizeAttachmentCount(input?.attachmentCount)

  return freezeDeep({
    originalText: text,
    command: command === null ? null : freezeDeep({ token: command.text, end: command.end }),
    segments,
    protectedItems,
    naturalText,
    hasEnhanceableText: naturalText.trim().length > 0,
    attachmentCount,
  })
}

export function protectedItemsForDraft(draft) {
  return draft?.protectedItems ?? []
}

export function commandOnly(draft) {
  return draft.command !== null && !draft.hasEnhanceableText
}

export function renderSegments(draft) {
  return draft.segments.map(segment => {
    const label = segment.kind === 'command'
      ? 'slash command'
      : segment.kind === 'file-reference'
        ? 'file/reference'
        : segment.kind
    return `- ${label}: ${JSON.stringify(segment.text)}`
  }).join('\n')
}

function normalizeExplicitCommand(command, text) {
  if (typeof command !== 'string' || command.length === 0) return undefined
  const token = command.trimEnd()
  if (!/^\/\S+$/u.test(token) || !text.startsWith(token)) return undefined
  return token
}

function validateOccurrence(occurrence, text) {
  if (occurrence === null || typeof occurrence !== 'object') return undefined
  const { offset, length, clipboardText } = occurrence
  if (!Number.isInteger(offset) || !Number.isInteger(length) || length <= 0) return undefined
  if (typeof clipboardText !== 'string' || clipboardText.length !== length) return undefined
  if (offset < 0 || offset + length > text.length) return undefined
  if (text.slice(offset, offset + length) !== clipboardText) return undefined
  return { start: offset, end: offset + length, text: clipboardText }
}

function addMatches(candidates, text, pattern, kind, priority, trimTrailing = false) {
  for (const match of text.matchAll(pattern)) {
    const candidate = trimTrailing === true
      ? match[0].replace(/[.,;:!?)\]}'"…]+$/u, '')
      : match[0]
    if (candidate.length === 0) continue
    candidates.push({
      kind,
      start: match.index,
      end: match.index + candidate.length,
      text: candidate,
      priority,
    })
  }
}

function selectNonOverlapping(candidates) {
  const sorted = [...candidates].sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start
    if (left.priority !== right.priority) return right.priority - left.priority
    return right.end - left.end
  })
  const selected = []
  let end = 0
  for (const candidate of sorted) {
    if (candidate.start < end) continue
    if (candidate.text.trim().length === 0) continue
    selected.push(candidate)
    end = candidate.end
  }
  return selected
}

function toSegments(text, selected) {
  const segments = []
  let cursor = 0
  for (const item of selected) {
    if (item.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, item.start) })
    }
    segments.push({
      kind: item.kind,
      text: item.text,
      ...(item.label === undefined ? {} : { label: item.label }),
      ...(item.source === undefined ? {} : { source: item.source }),
      ...(item.ref === undefined ? {} : { ref: item.ref }),
    })
    cursor = item.end
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) })
  }
  return segments
}

function normalizeAttachmentCount(value) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 1000) : 0
}
