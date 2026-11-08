import assert from 'node:assert/strict'
import test from 'node:test'

import { createDshModelProvider, resolveAdaptiveTimeout, resolveInitialBudget } from '../src/core/provider.js'

/** 可配置 mock：每一步描述一次 stream 的行为。 */
function harness(script, overrides = {}) {
  const calls = []
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          async *stream(options) {
            const index = Math.min(calls.length, script.length - 1)
            const step = script[index]
            calls.push({ maxTokens: options.maxTokens })
            if (step.kind === 'hang') {
              await new Promise(() => {}) // 永不 settle，且忽略 signal
              return
            }
            if (step.delay !== undefined) await new Promise(resolve => setTimeout(resolve, step.delay))
            yield { type: 'text-delta', text: '{"enhancedPrompt":"x","openQuestions":[]}' }
            yield { type: 'finish', reason: { kind: step.kind } }
          },
        }
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
      return undefined
    },
  }
  const config = {
    maxOutputTokens: 8192,
    maxOutputTokensCap: 16000,
    timeoutMs: 5000,
    temperature: 0.2,
    reasoningEffort: undefined,
    ...overrides,
  }
  return { provider: createDshModelProvider({ ctx, config, session: undefined }), calls }
}

test('maxOutputTokensCap 收紧预算上限', () => {
  assert.equal(resolveInitialBudget({ maxOutputTokens: 8192, maxOutputTokensCap: 4000 }, '字'.repeat(8000)), 4000)
  assert.equal(resolveInitialBudget({ maxOutputTokens: 8192, maxOutputTokensCap: 4000 }, '短'), 4000)
})

test('连续截断时用满 cap 并报出真实预算', async () => {
  const { provider, calls } = harness([{ kind: 'max-tokens' }], { maxOutputTokens: 128, maxOutputTokensCap: 4000 })
  await assert.rejects(
    () => provider.complete({ system: 's', user: 'u' }),
    /even at 4000 tokens/,
    '报错应写真实用到的预算 4000，而不是默认 16000',
  )
  assert.equal(calls[calls.length - 1].maxTokens, 4000)
})

test('挂起的 stream 也能被取消（不依赖 llm.stream 响应 signal）', async () => {
  const { provider, calls } = harness([{ kind: 'hang' }])
  const controller = new AbortController()
  const started = Date.now()
  const promise = provider.complete({ system: 's', user: 'u', signal: controller.signal })
  setTimeout(() => controller.abort(new Error('user cancelled')), 30)
  await assert.rejects(promise)
  const elapsed = Date.now() - started
  assert.ok(elapsed < 1000, `取消应立即返回，实际耗时 ${elapsed}ms`)
  assert.equal(calls.length, 1)
})

test('total timeout 是整次增强的共享时限，不会每轮重算', async () => {
  // 两轮各 60ms，总时限 90ms：第一轮通过，第二轮开始前已过期或超时。
  const { provider, calls } = harness(
    [{ kind: 'max-tokens', delay: 60 }, { kind: 'stop', delay: 60 }],
    { timeoutMs: 90 },
  )
  const started = Date.now()
  await assert.rejects(() => provider.complete({ system: 's', user: 'u' }))
  const elapsed = Date.now() - started
  assert.ok(elapsed < 200, `总耗时应受 90ms 约束，实际 ${elapsed}ms`)
  assert.ok(calls.length >= 1)
})

test('idleTimeoutMs 会先于总时限打断卡死的请求', async () => {
  // 模型永不返回任何事件：总时限 5s，空闲 250ms，应当在 1s 内就断。
  const { provider } = harness([{ kind: 'hang' }], { timeoutMs: 5000, idleTimeoutMs: 250 })
  const started = Date.now()
  await assert.rejects(() => provider.complete({ system: 's', user: 'u' }), /did not start responding/u)
  const elapsed = Date.now() - started
  assert.ok(elapsed < 1500, `空闲超时应当早于总时限，实际 ${elapsed}ms`)
})

test('自适应时限：按输入规模放宽，配置是硬顶，小配置不被抬高', () => {
  const generous = { timeoutMs: 180000 }
  const short = resolveAdaptiveTimeout(generous, { originalText: '短草稿' }, { promptChars: 300, outputChars: 4000 })
  const long = resolveAdaptiveTimeout(generous, { originalText: '字'.repeat(3000) }, { promptChars: 20000, outputChars: 4000 })
  // 短提示词也不低于 30 秒：0.4.0 之后系统提示词本身就有几千字符。
  assert.ok(short >= 30000, String(short))
  assert.ok(short < 60000, String(short))
  // 输入越长约宽，但都不越配置硬顶。
  assert.ok(long > short, `${long} vs ${short}`)
  assert.ok(long <= 180000, String(long))
  // 想快速失败时，自适应不得把配置抬高。
  assert.equal(resolveAdaptiveTimeout({ timeoutMs: 90 }, { originalText: '字'.repeat(3000) }, { promptChars: 9000 }), 90)
})

test('输出上限不会被当成典型输出用于估时', () => {
  // maxResultChars 默认 40000，直接拿来估时会让预算永远顶到硬顶，自适应就失效了。
  const generous = { timeoutMs: 180000 }
  const huge = resolveAdaptiveTimeout(generous, { originalText: 'x' }, { promptChars: 1000, outputChars: 40000 })
  const typical = resolveAdaptiveTimeout(generous, { originalText: 'x' }, { promptChars: 1000, outputChars: 4000 })
  assert.equal(huge, typical)
  assert.ok(typical < 180000, String(typical))
})
