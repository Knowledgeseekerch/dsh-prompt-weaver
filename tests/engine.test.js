import assert from 'node:assert/strict'
import test from 'node:test'

import { createPromptWeaverEngine } from '../src/core/engine.js'
import { createFrameworkStore } from '../src/core/frameworks.js'
import { readConfig } from '../src/core/config.js'
import { createLocalModelProvider } from '../src/core/local-provider.js'
import { createStaticModelProvider } from '../src/core/provider.js'

function createEngine(options = {}) {
  const config = readConfig(options.config)
  return createPromptWeaverEngine({
    config,
    frameworkStore: createFrameworkStore(),
    provider: options.provider ?? createLocalModelProvider(),
    contextProvider: options.contextProvider ?? (() => ({
      projectAvailable: false,
      files: [],
      tree: [],
      conversation: [],
      conversationMessages: 0,
      redactions: [],
      totalBytes: 0,
    })),
  })
}

test('local engine enhances mixed draft and preserves protected items', async () => {
  const engine = createEngine()
  const result = await engine.enhance({
    text: '/prompt fix @src/app.ts and https://example.com/spec on Node.js 22.19. Do not change the database.',
    locale: 'zh',
  })
  assert.equal(result.ok, true)
  assert.equal(result.text.startsWith('/prompt'), true)
  assert.ok(result.text.includes('@src/app.ts'))
  assert.ok(result.text.includes('https://example.com/spec'))
  assert.ok(result.text.includes('22.19'))
  assert.ok(result.text.includes('Do not change the database.'))
  assert.equal(result.quality.passed, true)
  assert.equal(result.framework, 'debugging')
})

test('engine rejects command-only draft instead of silently failing', async () => {
  const engine = createEngine()
  await assert.rejects(() => engine.enhance({ text: '/compact' }), /only a slash command/)
})

test('engine blocks high-confidence secrets by default', async () => {
  const engine = createEngine()
  await assert.rejects(
    () => engine.enhance({ text: 'Use api_key=sk-abcdef1234567890abcdef to fix the build' }),
    /credentials or private keys/,
  )
})

test('engine enforces draft length before calling the model', async () => {
  const engine = createEngine({ config: { maxDraftChars: 200 } })
  await assert.rejects(() => engine.enhance({ text: 'x'.repeat(250) }), /200 character limit/)
})

test('engine rejects model output that adds unverified assumptions', async () => {
  const engine = createEngine({
    provider: createStaticModelProvider([JSON.stringify({
      enhancedPrompt: 'Fix the login button.',
      openQuestions: [],
      assumptions: ['The database is Postgres.'],
      usedContext: [],
    })]),
  })
  await assert.rejects(() => engine.enhance({ text: 'Fix the login button.', mode: 'strict' }), /introduced an assumption/)
})

test('engine still delivers the text when it loses the slash command or references', async () => {
  // 违规只作记录，不再否决整次增强：模型给了文本就交付，
  // 否则用户点了增强却什么也拿不到，比拿到一份有偏离的结果更糟。
  const engine = createEngine({
    provider: createStaticModelProvider([JSON.stringify({
      enhancedPrompt: 'Fix the button.',
      openQuestions: [],
      assumptions: [],
      usedContext: [],
    })]),
  })
  const result = await engine.enhance({ text: '/prompt fix @src/app.ts', mode: 'strict' })
  assert.equal(result.ok, true)
  assert.equal(result.text, 'Fix the button.')
  assert.equal(result.quality.passed, false)
  assert.ok(result.violations.length > 0)
  assert.equal(result.violations.some(violation => violation.code === 'protected-item-lost'), true)
})

test('engine supports explicit framework selection', async () => {
  const engine = createEngine()
  const result = await engine.enhance({
    text: 'Research cache invalidation strategies. Must cite official docs.',
    frameworkId: 'research',
    locale: 'en',
  })
  assert.equal(result.framework, 'research')
})

test('engine supports bounded iteration with feedback as a constraint', async () => {
  const engine = createEngine()
  const result = await engine.enhance({
    text: 'Fix the login button.',
    iteration: {
      round: 1,
      previousText: 'Fix the login button.',
      feedback: 'Do not change the database schema.',
    },
  })
  assert.equal(result.ok, true)
  assert.ok(result.text.includes('不要修改数据库') || result.text.includes('Do not change the database schema.'))
  assert.equal(result.iteration.round, 1)
  assert.equal(result.iteration.max, 5)
})

test('engine rejects iteration beyond configured maximum', async () => {
  const engine = createEngine()
  await assert.rejects(() => engine.enhance({
    text: 'Fix the login button.',
    iteration: { round: 99, previousText: 'Fix the login button.', feedback: 'Add tests.' },
  }), /1 to 5/)
})
