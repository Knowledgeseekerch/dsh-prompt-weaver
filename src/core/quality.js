import { parseMixedDraft } from './draft.js'
import { detectLanguage, extractConstraints } from './analyze.js'
import { freezeDeep, scriptCounts } from './utils.js'

export function evaluateQuality({
  draft,
  analysis,
  enhancedPrompt,
  allowedNewTokens = [],
  mode = 'standard',
  enforceInventedReferences = true,
}) {
  const violations = []
  const original = draft.originalText
  const enhanced = enhancedPrompt ?? ''

  for (const item of draft.protectedItems) {
    const present = enhanced.includes(item.text)
    const commandAtStart = item.kind !== 'command' || enhanced.startsWith(item.text)
    if (!present || !commandAtStart) {
      violations.push({
        code: 'protected-item-lost',
        message: `Protected ${item.kind} was not preserved.`,
        item: { kind: item.kind, text: item.text },
      })
    }
  }

  const retainedConstraints = []
  for (const constraint of analysis.constraints) {
    const retained = enhanced.includes(constraint.anchor)
    if (retained) retainedConstraints.push(constraint.id)
    else {
      violations.push({
        code: 'constraint-lost',
        message: 'An original constraint was not preserved verbatim.',
        item: { id: constraint.id, marker: constraint.marker },
      })
    }
  }

  const languageCheck = checkLanguagePreservation(original, enhanced)
  if (!languageCheck.passed) {
    violations.push({ code: 'language-changed', message: 'The primary natural language of the prompt changed.', item: languageCheck })
  }

  const invented = enforceInventedReferences === true
    ? findInventedReferences(original, enhanced, allowedNewTokens)
    : []
  if (invented.length > 0) {
    violations.push({
      code: 'invented-reference',
      message: 'The enhanced prompt introduced a reference that was not in the draft or allowed context.',
      item: { count: invented.length, references: invented.slice(0, 10) },
    })
  }

  const lengthRatio = original.length === 0 ? 0 : enhanced.length / original.length
  // 短草稿只按比例限制会必然误杀：7 个字 ×6 只有 42 字符，任何成形提示词都会超。
  // 因此上限取 max(原文 × 6, 原文 + 800)，长草稿仍由比例控制，短草稿有绝对余量。
  const lengthCap = Math.max(original.length * 8, original.length + 4000)
  if (enhanced.length > 0 && (enhanced.length > lengthCap || (original.length > 200 && lengthRatio < 0.2))) {
    violations.push({
      code: 'length-out-of-range',
      message: 'The enhanced prompt length changed too dramatically.',
      item: { ratio: Number(lengthRatio.toFixed(2)), originalLength: original.length, enhancedLength: enhanced.length },
    })
  }

  if (mode === 'strict' && enhanced.trim() === original.trim()) {
    // Exact identity is allowed in strict mode; it is not a violation.
  }

  const protectedRatio = ratio(draft.protectedItems.length, draft.protectedItems.filter(item => enhanced.includes(item.text)).length)
  const constraintRatio = ratio(analysis.constraints.length, retainedConstraints.length)
  const structureDelta = structuralScore(enhanced, analysis) - structuralScore(original, analysis)
  const score = Math.round(
    Math.max(0, Math.min(100,
      35 +
      protectedRatio * 25 +
      constraintRatio * 20 +
      Math.max(0, Math.min(15, structureDelta)) +
      concisenessScore(original, enhanced),
    )),
  )

  return freezeDeep({
    passed: violations.length === 0,
    violations,
    score,
    metrics: {
      originalLength: original.length,
      enhancedLength: enhanced.length,
      lengthRatio: Number(lengthRatio.toFixed(3)),
      protectedItemCount: draft.protectedItems.length,
      retainedProtectedItemCount: draft.protectedItems.filter(item => enhanced.includes(item.text)).length,
      constraintCount: analysis.constraints.length,
      retainedConstraintIds: retainedConstraints,
      structureScoreOriginal: structuralScore(original, analysis),
      structureScoreEnhanced: structuralScore(enhanced, analysis),
    },
  })
}

export function comparePrompts(original, enhanced) {
  const originalDraft = parseMixedDraft(original)
  const enhancedDraft = parseMixedDraft(enhanced)
  const constraints = extractConstraints(original)
  const originalLanguage = detectLanguage(original)
  const enhancedLanguage = detectLanguage(enhanced)
  const analysis = {
    constraints,
    openQuestions: [],
    taskType: 'general',
    language: originalLanguage,
  }
  const originalQuality = evaluateQuality({
    draft: originalDraft,
    analysis,
    enhancedPrompt: original,
    enforceInventedReferences: false,
  })
  const enhancedQuality = evaluateQuality({
    draft: originalDraft,
    analysis,
    enhancedPrompt: enhanced,
    enforceInventedReferences: false,
  })
  return freezeDeep({
    original: summarizePrompt(original, originalQuality, originalLanguage),
    enhanced: summarizePrompt(enhanced, enhancedQuality, enhancedLanguage),
    delta: {
      score: enhancedQuality.score - originalQuality.score,
      length: enhanced.length - original.length,
      structureScore: enhancedQuality.metrics.structureScoreEnhanced - originalQuality.metrics.structureScoreOriginal,
    },
  })
}

export function checkLanguagePreservation(original, enhanced) {
  const originalCounts = scriptCounts(original)
  const enhancedCounts = scriptCounts(enhanced)
  const originalLetters = totalLetters(originalCounts)
  const enhancedLetters = totalLetters(enhancedCounts)
  if (originalLetters === 0 || enhancedLetters === 0) {
    return { passed: enhancedLetters > 0, original: 'unknown', enhanced: 'unknown' }
  }
  const originalCjkRatio = originalCounts.cjk / originalLetters
  const enhancedCjkRatio = enhancedCounts.cjk / enhancedLetters
  if (originalCjkRatio >= 0.15 && enhancedCjkRatio === 0) {
    return { passed: false, original: 'zh', enhanced: 'non-zh', originalCjkRatio, enhancedCjkRatio }
  }
  if (originalCjkRatio === 0 && enhancedCjkRatio >= 0.2) {
    return { passed: false, original: 'non-zh', enhanced: 'zh', originalCjkRatio, enhancedCjkRatio }
  }
  return {
    passed: true,
    original: originalCjkRatio >= 0.15 ? 'zh' : 'non-zh',
    enhanced: enhancedCjkRatio >= 0.15 ? 'zh' : 'non-zh',
    originalCjkRatio,
    enhancedCjkRatio,
  }
}

function findInventedReferences(original, enhanced, allowedNewTokens) {
  const originalDraft = parseMixedDraft(original)
  const enhancedDraft = parseMixedDraft(enhanced)
  const originalTokens = new Set(originalDraft.protectedItems.map(item => item.text))
  const allowed = new Set(allowedNewTokens)
  const inventions = []
  for (const item of enhancedDraft.protectedItems) {
    if (item.kind === 'command' || item.kind === 'text') continue
    if (originalTokens.has(item.text) || allowed.has(item.text)) continue
    inventions.push({ kind: item.kind, text: item.text })
  }
  return inventions
}

function structuralScore(prompt, analysis) {
  if (prompt.trim().length === 0) return 0
  let score = 0
  const lines = prompt.split(/\n/u).filter(line => line.trim().length > 0)
  const headings = lines.filter(line => /^#{1,3}\s|^\[[^\]]{1,20}\]\s*[:：]/u.test(line.trim())).length
  const bullets = lines.filter(line => /^\s*(?:[-*•]|\d+[.)、])\s+/u.test(line)).length
  const hasOutput = /输出|交付|output|deliverable|format|格式/u.test(prompt)
  const hasValidation = /验收|验证|测试|acceptance|verify|test/u.test(prompt)
  const hasQuestions = /待确认|open question|\?|？/u.test(prompt)
  score += Math.min(6, headings * 2)
  score += Math.min(6, bullets * 1.5)
  if (hasOutput) score += 2
  if (hasValidation) score += 2
  if (hasQuestions) score += 2
  if (analysis.constraints.length > 0 && /约束|constraint|不得|不要|must not|do not/iu.test(prompt)) score += 2
  return Math.round(Math.min(20, score))
}

function concisenessScore(original, enhanced) {
  if (original.length === 0) return 0
  const ratio = enhanced.length / original.length
  if (ratio <= 1) return 5
  if (ratio <= 2) return 4
  if (ratio <= 3) return 3
  if (ratio <= 4) return 2
  if (ratio <= 6) return 1
  return 0
}

function ratio(total, retained) {
  return total === 0 ? 1 : retained / total
}

function totalLetters(counts) {
  return counts.cjk + counts.latin + counts.cyrillic + counts.arabic + counts.devanagari + counts.other
}

function summarizePrompt(prompt, quality, language) {
  return {
    length: prompt.length,
    score: quality.score,
    passed: quality.passed,
    language: language.primary,
    protectedItems: parseMixedDraft(prompt).protectedItems.length,
    constraints: extractConstraints(prompt).length,
  }
}
