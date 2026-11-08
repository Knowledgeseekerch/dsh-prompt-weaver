import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemPrompt } from '../src/core/prompt.js'
import { parseModelOutput } from '../src/core/structured.js'

const base = {
  enhancedPrompt: 'Do the thing.',
  openQuestions: [],
  assumptions: [],
  usedContext: [],
}

test('a premise check is kept when the model reports the premise does not hold', () => {
  const parsed = parseModelOutput(JSON.stringify({
    ...base,
    premiseCheck: {
      holds: false,
      problem: 'Registry entries and services live outside the install directory.',
      alternative: 'Install on the target drive, then migrate the database.',
    },
  }), { maxResultChars: 4000 })
  assert.deepEqual(parsed.premiseCheck, {
    problem: 'Registry entries and services live outside the install directory.',
    alternative: 'Install on the target drive, then migrate the database.',
  })
})

test('no premise check when the model omits it or says the premise holds', () => {
  assert.equal(parseModelOutput(JSON.stringify(base), { maxResultChars: 4000 }).premiseCheck, null)
  const holding = parseModelOutput(JSON.stringify({ ...base, premiseCheck: { holds: true } }), { maxResultChars: 4000 })
  assert.equal(holding.premiseCheck, null)
})

test('a malformed premise check is ignored instead of failing the run', () => {
  // 它是附加信息：字段坏了就当没给，不能因此丢掉整份增强结果。
  const parsed = parseModelOutput(JSON.stringify({ ...base, premiseCheck: { holds: false } }), { maxResultChars: 4000 })
  assert.equal(parsed.premiseCheck, null)
  assert.equal(parsed.enhancedPrompt, 'Do the thing.')
})

test('the system prompt says a premise flag is not an added requirement', () => {
  const system = buildSystemPrompt({ mode: 'standard', framework: undefined, locale: 'en', maxResultChars: 4000 })
  assert.match(system, /premiseCheck/u)
  assert.match(system, /NOT an addition/u)
  // 同时要拦住滥用：缺细节、有歧义都不算前提失败。
  assert.match(system, /impossibility is concrete/u)
})
