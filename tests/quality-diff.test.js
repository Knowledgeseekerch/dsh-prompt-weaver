import assert from 'node:assert/strict'
import test from 'node:test'

import { parseMixedDraft } from '../src/core/draft.js'
import { analyzeDraft } from '../src/core/analyze.js'
import { evaluateQuality, comparePrompts, checkLanguagePreservation } from '../src/core/quality.js'
import { diffSummary, renderUnifiedDiff } from '../src/core/diff.js'

function analyze(text) {
  return analyzeDraft(parseMixedDraft(text))
}

test('quality gate rejects lost protected items', () => {
  const draft = parseMixedDraft('Fix @src/app.ts. Do not change the database.')
  const analysis = analyzeDraft(draft)
  const result = evaluateQuality({
    draft,
    analysis,
    enhancedPrompt: 'Fix the button. Do not change the database.',
  })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(violation => violation.code === 'protected-item-lost'))
})

test('quality gate rejects lost constraints', () => {
  const draft = parseMixedDraft('Fix the button. Do not change the database.')
  const analysis = analyzeDraft(draft)
  const result = evaluateQuality({
    draft,
    analysis,
    enhancedPrompt: 'Fix the button.',
  })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(violation => violation.code === 'constraint-lost'))
})

test('quality gate rejects language replacement', () => {
  const draft = parseMixedDraft('请修复登录按钮')
  const analysis = analyzeDraft(draft)
  const result = evaluateQuality({
    draft,
    analysis,
    enhancedPrompt: 'Fix the login button.',
  })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(violation => violation.code === 'language-changed'))
})

test('quality gate rejects references invented outside draft and context', () => {
  const draft = parseMixedDraft('Fix the login button.')
  const analysis = analyzeDraft(draft)
  const result = evaluateQuality({
    draft,
    analysis,
    enhancedPrompt: 'Fix the login button in src/invented.ts.',
  })
  assert.equal(result.passed, false)
  assert.ok(result.violations.some(violation => violation.code === 'invented-reference'))
})

test('context paths are allowed as grounded references', () => {
  const draft = parseMixedDraft('Fix the login button.')
  const analysis = analyzeDraft(draft)
  const result = evaluateQuality({
    draft,
    analysis,
    enhancedPrompt: 'Fix the login button in src/app.ts.',
    allowedNewTokens: ['src/app.ts'],
  })
  assert.equal(result.passed, true)
})

test('comparison reports before and after metrics', () => {
  const original = 'Fix the login button.'
  const enhanced = '[Goal]\nFix the login button in src/app.ts.\n\n[Validation]\nRun npm test.'
  const comparison = comparePrompts(original, enhanced)
  assert.equal(comparison.original.length, original.length)
  assert.equal(comparison.enhanced.length, enhanced.length)
  assert.ok(comparison.delta.structureScore > 0)
  assert.equal(comparison.enhanced.passed, true)
})

test('language preservation helper accepts technical identifiers', () => {
  assert.equal(checkLanguagePreservation('请修复 src/app.ts', '请修复 src/app.ts 的登录问题').passed, true)
})

test('diff summary and unified diff mark additions', () => {
  const diff = diffSummary('alpha beta', 'alpha beta gamma')
  assert.equal(diff.insertedCount >= 1, true)
  assert.match(renderUnifiedDiff('alpha beta', 'alpha beta gamma'), /gamma/)
})
