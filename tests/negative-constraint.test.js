import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSystemPrompt } from '../src/core/prompt.js'

function system() {
  return buildSystemPrompt({ mode: 'standard', framework: undefined, locale: 'en', maxResultChars: 4000 })
}

test('a negative constraint must be checked by meaning, not by a word list', () => {
  // 案例：用户要求「不要任何绕轴旋转」，执行方给出「灯丝呈螺旋状盘绕」就能骗过关键词黑名单。
  // 规则必须要求执行方自己列意象、按含义判族，而不是把词表塞给它。
  const text = system()
  assert.match(text, /never turn it into a keyword blacklist/u)
  assert.match(text, /by meaning rather than by wording/u)
  assert.match(text, /spiral/u)
})

test('the negative-constraint rule does not weaken the no-addition rule', () => {
  // 自查要求不能变成「允许执行方自己加需求」的缺口。
  const text = system()
  assert.match(text, /Requiring that self-check is sharpening; handing them the word list is not/u)
})
