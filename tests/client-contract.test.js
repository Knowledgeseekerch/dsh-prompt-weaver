import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const clientPath = fileURLToPath(new URL('../client.js', import.meta.url))
const source = readFileSync(clientPath, 'utf8')

test('client registers the composer slot and public RPC endpoints', () => {
  assert.match(source, /conversation\.input\.right/u)
  assert.match(source, /promptWeaver\/enhance/u)
  assert.match(source, /promptWeaver\/listFrameworks/u)
  assert.match(source, /promptWeaver\/importConfig/u)
  assert.match(source, /promptWeaver\/exportConfig/u)
})

test('client preserves attachments and slash-command input instead of rejecting it', () => {
  assert.match(source, /attachmentIds/u)
  assert.match(source, /attachmentCount/u)
  assert.match(source, /inferCommand/u)
  assert.match(source, /requestBase/u)
  assert.equal(/innerHTML/u.test(source), false)
})

test('client does not auto-submit or persist prompt text', () => {
  assert.equal(/localStorage/u.test(source), false)
  assert.equal(/sessionStorage/u.test(source), false)
  assert.equal(/\.submit\(/u.test(source), false)
  assert.match(source, /inputActions\.setDraft/u)
})

test('both enhancement paths share one write-back gate', () => {
  // 面板与一键增强必须过同一个 canApplyResult：只要其中一条漏掉，
  // 用户就能从那条路径把带违规的结果直接盖进输入框，门禁形同虚设。
  const sites = source.match(/canApplyResult\(/gu) ?? []
  assert.ok(sites.length >= 3, `expected one definition and two call sites, saw ${sites.length}`)
  assert.match(source, /if \(!canApplyResult\(value\)\)/u)
})

test('the result panel shows assumptions and open questions instead of bare counts', () => {
  assert.match(source, /renderAssumptions\(/u)
  // openQuestions 是 { question, reason } 对象，直接 String() 会渲染成 [object Object]。
  assert.match(source, /openQuestionText\(/u)
})
