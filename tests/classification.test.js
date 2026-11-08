import assert from 'node:assert/strict'
import test from 'node:test'

import { detectTaskType, looksLikeOperation, looksLikeQuestion } from '../src/core/analyze.js'

/** [输入, 期望类型, 说明] */
const CASES = [
  ['打开抖音并点赞', 'automation', '中文界面操作'],
  ['如何打开抖音并点赞', 'automation', '带疑问词但仍是操作诉求，操作优先于提问'],
  ['打开设置页面并点击导出', 'automation', '含「页面」不代表是开发任务'],
  ['导出接口文档', 'automation', '含「接口」不代表是开发任务'],
  ['Open settings and click Export', 'automation', '英文操作句'],
  ['请帮我实现登录功能', 'code', '含「实现」，是开发任务而非操作'],
  ['This is important', 'general', 'import 不应命中 important 的子串'],
  ['Wholesale prices are rising', 'general', 'who 不应命中 Wholesale 的子串'],
  ['open prefix editor', 'automation', 'fix 不应命中 prefix 的子串；open 是操作词'],
  ['什么是 DeepSeek Harness？', 'question', '明确提问'],
  ['Who maintains this?', 'question', '英文提问'],
]

for (const [text, expected, note] of CASES) {
  test(`classifies ${JSON.stringify(text)} as ${expected}`, () => {
    const result = detectTaskType(text)
    assert.equal(result.type, expected, `${note} (got ${result.type})`)
  })
}

test('looksLikeOperation requires an operation verb and no build verb', () => {
  assert.equal(looksLikeOperation('打开抖音并点赞'), true)
  assert.equal(looksLikeOperation('实现自动点赞脚本'), false, '含「实现」应排除')
  assert.equal(looksLikeOperation('This is important'), false, 'import 不应命中')
})

test('looksLikeQuestion excludes request and build phrasing', () => {
  assert.equal(looksLikeQuestion('什么是 DeepSeek Harness？'), true)
  assert.equal(looksLikeQuestion('请帮我实现登录功能'), false)
  assert.equal(looksLikeQuestion('如何打开抖音并点赞'), true, '疑问词命中；由 operation 优先级决定最终类型')
})

test('length boundaries: empty is not a question, 300 chars allowed, 301 rejected', () => {
  assert.equal(looksLikeQuestion(''), false)
  assert.equal(looksLikeQuestion('什么'.repeat(150)), true, '300 字仍在范围内')
  assert.equal(looksLikeQuestion('什么'.repeat(151)), false, '超过 300 字按任务处理')
})

// 已知限制：字面是提问，目前判为 question，不当作构建任务。
test('known limitation: 怎么做页面 stays a question', () => {
  assert.equal(detectTaskType('怎么做页面').type, 'question')
})
