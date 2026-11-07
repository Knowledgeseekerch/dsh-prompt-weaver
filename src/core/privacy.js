import { freezeDeep } from './utils.js'

const SECRET_PATTERNS = Object.freeze([
  { kind: 'credential-assignment', pattern: /\b(?:api[_-]?key|token|secret|password|passwd|authorization|auth)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{12,}["']?/giu },
  { kind: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/gu },
  { kind: 'aws-access-key', pattern: /\bAKIA[0-9A-Z]{16}\b/gu },
  { kind: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/gu },
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu },
  { kind: 'provider-key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/gu },
])

export function scanSecrets(text, maxRedactions = 200) {
  const findings = []
  for (const definition of SECRET_PATTERNS) {
    for (const match of String(text ?? '').matchAll(definition.pattern)) {
      if (match[0].length === 0) continue
      findings.push({
        kind: definition.kind,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }
  findings.sort((left, right) => left.start - right.start)
  const selected = []
  let cursor = -1
  for (const finding of findings) {
    if (finding.start < cursor) continue
    selected.push(finding)
    cursor = finding.end
    if (selected.length >= maxRedactions) break
  }
  return selected
}

export function containsHighConfidenceSecret(text) {
  return scanSecrets(text, 1).length > 0
}

export function redactSecrets(text, maxRedactions = 200) {
  const source = String(text ?? '')
  const findings = scanSecrets(source, maxRedactions)
  if (findings.length === 0) {
    return { text: source, redactions: [] }
  }
  let result = ''
  let cursor = 0
  const redactions = []
  for (const finding of findings) {
    result += source.slice(cursor, finding.start)
    const replacement = `[REDACTED:${finding.kind}:${redactions.length + 1}]`
    result += replacement
    cursor = finding.end
    redactions.push({
      kind: finding.kind,
      start: finding.start,
      end: finding.end,
      replacement,
    })
  }
  result += source.slice(cursor)
  return freezeDeep({ text: result, redactions })
}

export function redactContextParts(parts, maxRedactions = 200) {
  const redactedParts = []
  const allRedactions = []
  for (const part of parts) {
    if (typeof part !== 'string') {
      redactedParts.push(part)
      continue
    }
    const redacted = redactSecrets(part, maxRedactions)
    redactedParts.push(redacted.text)
    allRedactions.push(...redacted.redactions)
  }
  return { parts: redactedParts, redactions: allRedactions.slice(0, maxRedactions) }
}
