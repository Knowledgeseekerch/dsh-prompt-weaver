import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeDraft, detectLanguage, extractConstraints } from '../src/core/analyze.js'
import { commandOnly, parseMixedDraft, renderSegments } from '../src/core/draft.js'

test('mixed draft preserves slash command, file references, URLs, and versions', () => {
  const text = '/prompt fix @src/app.ts and https://example.com/spec on Node.js 22.19. Do not change the database.'
  const draft = parseMixedDraft({ text, attachmentCount: 2 })
  assert.equal(draft.command.token, '/prompt')
  assert.equal(draft.attachmentCount, 2)
  const protectedTexts = draft.protectedItems.map(item => item.text)
  assert.ok(protectedTexts.includes('/prompt'))
  assert.ok(protectedTexts.includes('@src/app.ts'))
  assert.ok(protectedTexts.includes('https://example.com/spec'))
  assert.ok(protectedTexts.includes('22.19'))
  assert.equal(draft.hasEnhanceableText, true)
  assert.equal(commandOnly(draft), false)
  assert.match(renderSegments(draft), /slash command/)
})

test('command-only draft is detected', () => {
  const draft = parseMixedDraft('/compact')
  assert.equal(commandOnly(draft), true)
  assert.equal(draft.hasEnhanceableText, false)
})

test('explicit occurrences are trusted only when they match text', () => {
  const text = 'Review [src/app.ts:12-20] now'
  const draft = parseMixedDraft({
    text,
    occurrences: [{
      source: 'file',
      ref: 'file-1',
      offset: text.indexOf('[src/app.ts:12-20]'),
      length: '[src/app.ts:12-20]'.length,
      label: 'src/app.ts',
      clipboardText: '[src/app.ts:12-20]',
      appearance: 'file',
    }],
  })
  assert.ok(draft.protectedItems.some(item => item.kind === 'file-reference'))
  const bad = parseMixedDraft({
    text,
    occurrences: [{ source: 'file', ref: 'file-2', offset: 0, length: 4, clipboardText: 'wrong' }],
  })
  assert.equal(bad.protectedItems.some(item => item.source === 'file'), false)
})

test('language detection distinguishes Chinese and English prose', () => {
  assert.equal(detectLanguage('帮我修复登录按钮').primary, 'zh')
  assert.equal(detectLanguage('Fix the login button').primary, 'en')
  assert.equal(detectLanguage('1234567890').primary, 'unknown')
})

test('constraints are extracted with original anchors', () => {
  const constraints = extractConstraints('必须兼容 API v1.2；不要修改数据库；请输出 JSON')
  const anchors = constraints.map(constraint => constraint.anchor)
  assert.ok(anchors.includes('必须兼容 API v1.2'))
  assert.ok(anchors.includes('不要修改数据库'))
  assert.ok(constraints.some(constraint => constraint.kind === 'prohibition'))
})

test('analysis includes ambiguity heuristics without inventing answers', () => {
  const draft = parseMixedDraft('优化一下这个')
  const analysis = analyzeDraft(draft)
  assert.ok(analysis.openQuestions.length > 0)
  assert.ok(analysis.openQuestions.every(question => question.source !== undefined))
  assert.equal(analysis.taskType, 'general')
})

test('mixed engineering prompt is not classified as general', () => {
  const draft = parseMixedDraft('修复 src/login.ts 的登录问题，不要引入新依赖')
  const analysis = analyzeDraft(draft)
  assert.notEqual(analysis.taskType, 'general')
  assert.ok(['code', 'debug'].includes(analysis.taskType))
})
