import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemPrompt } from '../src/core/prompt.js'

function system() {
  return buildSystemPrompt({ mode: 'standard', framework: undefined, locale: 'en', maxResultChars: 4000 })
}

test('a diagnostic draft gets the three pre-steps before any fix', () => {
  const text = system()
  // 1) 先把现象落到标准名称上
  assert.match(text, /Name the phenomenon/u)
  assert.match(text, /BugCheck/u)
  // 2) 把排除性证据提到前面
  assert.match(text, /Promote the excluding evidence/u)
  assert.match(text, /rules out|rules out nothing|rules out/u)
  // 3) 点名证据位置
  assert.match(text, /Name where the evidence lives/u)
  assert.match(text, /dump directory/u)
  assert.match(text, /event id/u)
})

test('the diagnostic rule is scoped to diagnosis, not every task', () => {
  // 只对诊断类生效，否则普通任务也会被迫跑一遍三步。
  assert.match(system(), /When the draft is a diagnosis/u)
})
