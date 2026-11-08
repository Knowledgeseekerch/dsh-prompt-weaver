import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeDraft } from '../src/core/analyze.js'
import { describeDimensions, detectDomains } from '../src/core/domains.js'
import { parseMixedDraft } from '../src/core/draft.js'
import { buildSystemPrompt, buildUserPayload } from '../src/core/prompt.js'

test('a build request picks the hardware and plan dimensions', () => {
  const domains = detectDomains('我想做一个智能小车，请给一套可行的实现方案，说明推进顺序')
  const ids = domains.map(domain => domain.id)
  assert.equal(ids.includes('hardware'), true)
  assert.equal(ids.includes('plan'), true)
  const hardware = domains.find(domain => domain.id === 'hardware')
  // 选型维度是「要回答什么」，不是「答案是什么」。
  assert.equal(hardware.dimensions.some(dimension => dimension.id === 'selection'), true)
})

test('an in-app operation picks only the operations domain', () => {
  const domains = detectDomains('打开抖音并点赞')
  assert.deepEqual(domains.map(domain => domain.id), ['operations'])
})

test('dimension descriptions follow the requested locale', () => {
  const domains = detectDomains('帮我做一个小车，要能避障')
  assert.equal(describeDimensions(domains, 'zh').some(line => line.includes('选型')), true)
  assert.equal(describeDimensions(domains, 'en').some(line => line.includes('chosen')), true)
})

test('the system prompt demands the dimensions without answering them', () => {
  const draft = parseMixedDraft('我想做一个智能小车，说明整体思路和推进的顺序')
  const analysis = analyzeDraft(draft)
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains: analysis.domains,
  })
  assert.match(system, /Task domain: hardware/u)
  assert.match(system, /specify the answer|请说明|选型/u)
  // 提示词只说要回答哪些维度，不能替用户把型号定下来。
  assert.equal(/用\s*(?:STM32|Arduino|ESP32)/u.test(system), false)
})

test('the user payload carries the domains and still holds no answers', () => {
  const draft = parseMixedDraft('我想做一个智能小车，说明整体思路和推进的顺序')
  const analysis = analyzeDraft(draft)
  const payload = JSON.parse(buildUserPayload({
    draft,
    analysis,
    framework: undefined,
    locale: 'zh',
    domains: analysis.domains,
  }))
  assert.equal(payload.domain.ids.includes('hardware'), true)
  assert.ok(payload.domain.dimensionsToCover.length > 0)
  assert.match(payload.domain.rule, /Do not answer/u)
  assert.equal(/STM32|Arduino|ESP32/u.test(JSON.stringify(payload.domain)), false)
})

test('a draft with no domain signal stays without dimensions', () => {
  const domains = detectDomains('。')
  assert.deepEqual([...domains], [])
})
