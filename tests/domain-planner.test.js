import assert from 'node:assert/strict'
import test from 'node:test'

import { readConfig } from '../src/core/config.js'
import { createDomainCache, normalizePlan, resolveDomains } from '../src/core/domain-planner.js'
import { createPromptWeaverEngine } from '../src/core/engine.js'
import { createFrameworkStore } from '../src/core/frameworks.js'

function stubProvider(outputs) {
  const calls = []
  return {
    calls,
    async complete({ system, user }) {
      calls.push({ system, user })
      const next = outputs.shift()
      if (next === undefined) throw new Error('no stubbed output left')
      return { content: next, model: { provider: 'stub', model: 'stub' } }
    },
  }
}

const config = readConfig()
const unknownDraft = {
  originalText: '帮我把简历润色一下',
  protectedItems: [],
  segments: [],
}
const unknownAnalysis = { taskType: 'general', language: { primary: 'zh' } }

const PLAN = JSON.stringify({
  domain: 'resume',
  dimensions: [
    { text: '目标岗位与职级', slots: ['岗位名', '职级'] },
    { text: '需要突出的经历', slots: ['项目', '成果'] },
  ],
})

test('normalizePlan keeps the dimensions and their slots', () => {
  const planned = normalizePlan(PLAN)
  assert.equal(planned.length, 1)
  assert.equal(planned[0].id, 'resume')
  assert.equal(planned[0].planned, true)
  assert.equal(planned[0].dimensions.length, 2)
  assert.deepEqual(planned[0].dimensions[0].slots.zh, ['岗位名', '职级'])
})

test('normalizePlan drops a dimension that names an answer instead of asking', () => {
  const planned = normalizePlan(JSON.stringify({
    domain: 'hardware',
    dimensions: [
      { text: '用 STM32F103 做主控', slots: ['型号'] },
      { text: '预算控制在 500 元以内', slots: ['价格'] },
      { text: '选型理由', slots: ['为什么'] },
    ],
  }))
  assert.equal(planned[0].dimensions.length, 1)
  assert.equal(planned[0].dimensions[0].zh, '选型理由')
})

test('normalizePlan rejects non-JSON and empty plans', () => {
  assert.deepEqual([...normalizePlan('not json')], [])
  assert.deepEqual([...normalizePlan('{"domain":"x","dimensions":[]}')], [])
})

test('resolveDomains never calls the model when the built-in library matches', async () => {
  const provider = stubProvider(['should not be used'])
  const domains = await resolveDomains({
    domains: [{ id: 'hardware', dimensions: [] }],
    draft: { originalText: '做一个智能小车', protectedItems: [], segments: [] },
    analysis: unknownAnalysis,
    provider,
    config,
  })
  assert.equal(provider.calls.length, 0)
  assert.equal(domains[0].id, 'hardware')
})

test('resolveDomains asks the model once for an unknown domain and caches the answer', async () => {
  const provider = stubProvider([PLAN])
  const cache = createDomainCache()
  const first = await resolveDomains({
    domains: [],
    draft: unknownDraft,
    analysis: unknownAnalysis,
    provider,
    config,
    cache,
  })
  assert.equal(provider.calls.length, 1)
  assert.equal(first[0].id, 'resume')

  const second = await resolveDomains({
    domains: [],
    draft: unknownDraft,
    analysis: unknownAnalysis,
    provider,
    config,
    cache,
  })
  // 第二次同一句草稿不该再打一次模型。
  assert.equal(provider.calls.length, 1)
  assert.equal(second[0].id, 'resume')
})

test('resolveDomains returns no dimensions when the planner is disabled or fails', async () => {
  const disabled = await resolveDomains({
    domains: [],
    draft: unknownDraft,
    analysis: unknownAnalysis,
    provider: stubProvider([PLAN]),
    config: readConfig({ autoDomains: false }),
  })
  assert.deepEqual([...disabled], [])

  const failing = await resolveDomains({
    domains: [],
    draft: unknownDraft,
    analysis: unknownAnalysis,
    provider: stubProvider([]),
    config,
  })
  assert.deepEqual([...failing], [])
})

test('the engine plans dimensions for an unknown domain before enhancing', async () => {
  const systems = []
  const provider = {
    id: 'stub',
    async complete({ system }) {
      systems.push(system)
      return {
        content: systems.length === 1
          ? PLAN
          : JSON.stringify({
            enhancedPrompt: '请把这份简历润色：说明目标岗位与职级，并指出需要突出的经历与成果。',
            openQuestions: [],
            assumptions: [],
            usedContext: [],
          }),
        model: { provider: 'stub', model: 'stub' },
      }
    },
  }
  const engine = createPromptWeaverEngine({
    config: readConfig(),
    frameworkStore: createFrameworkStore(),
    provider,
    contextProvider: () => ({
      projectAvailable: false,
      files: [],
      tree: [],
      conversation: [],
      conversationMessages: 0,
      redactions: [],
      totalBytes: 0,
    }),
  })
  const result = await engine.enhance({ text: '帮我把简历润色一下' })
  // 第一次是自举维度，第二次才是增强正身。
  assert.equal(systems.length, 2)
  assert.equal(result.ok, true)
  assert.match(systems[0], /List the dimensions/u)
  assert.match(systems[1], /Task domain: resume/u)
  assert.match(systems[1], /目标岗位与职级/u)
})
