import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeDraft } from '../src/core/analyze.js'
import { BUILTIN_FRAMEWORKS } from '../src/core/builtins.js'
import { assessCompleteness } from '../src/core/completeness.js'
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

test('blocking gaps are confirmed, the rest become parameters with defaults', () => {
  const text = '做一个智能小车，帮我出个方案'
  const domains = detectDomains(text)
  const completeness = assessCompleteness({ draft: { originalText: text }, domains, locale: 'zh' })
  // 预告：这条断言依赖 hardware 探针的判定结果，如果探针把整句都判成已答，它会提前失效。
  assert.ok(completeness.gaps.length > 0, 'expected the hardware draft to leave gaps')

  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains,
    completeness,
  })
  // 阻塞项仍要求跟用户确认。
  assert.match(system, /block the definition/u)
  // 非阻塞项明确不许变成提问，要折成带默认值的输入。
  assert.match(system, /Do not turn them into questions/u)
  assert.match(system, /input of the deliverable with a sensible default/u)
  // 待确认总量有上限，否则一次增强能吐出十几条。
  assert.match(system, /at most three items/u)
})

test('a software draft with no probes does not invent gaps', () => {
  const text = '帮我写个 Python 脚本批量缩图'
  const domains = detectDomains(text)
  const completeness = assessCompleteness({ draft: { originalText: text }, domains, locale: 'zh' })
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains,
    completeness,
  })
  // 没有探针就不该凭空造缺口，但仍然要按参数化规则办事。
  assert.equal(system.includes('block the definition'), false)
  assert.match(system, /could become an input of the deliverable/u)
})

test('the general framework asks for defaults before it asks for questions', () => {
  const general = BUILTIN_FRAMEWORKS.find(framework => framework.id === 'general')
  assert.ok(general !== undefined)

  // 以前验证一节写着「缺失时列入待确认」，等于逼模型产出一段待确认。
  const validation = general.sections.find(section => section.id === 'validation')
  assert.match(validation.guidance.en, /executable check/u)
  assert.equal(/move it to open questions/u.test(validation.guidance.en), false)

  // 待确认那一节改成先写默认值，问题只是兜底。
  const questions = general.sections.find(section => section.id === 'open-questions')
  assert.match(questions.guidance.en, /defaults adopted/u)
  assert.match(questions.guidance.en, /at most three/u)
})
