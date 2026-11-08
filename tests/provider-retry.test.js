import assert from 'node:assert/strict'
import test from 'node:test'

import { createDshModelProvider, resolveInitialBudget } from '../src/core/provider.js'

/**
 * 构造一个只提供 llm 的 ctx。`script` 里每一项是「一次 stream 调用要吐出的 finish 原因」，
 * 每次调用消耗一项；超出长度时复用最后一项。
 * 记录每次调用实际使用的 maxTokens，用于断言预算序列。
 */
function harness(script) {
  const calls = []
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          async *stream(options) {
            const index = Math.min(calls.length, script.length - 1)
            const step = script[index]
            calls.push({ maxTokens: options.maxTokens, step })
            if (step.kind === 'hang') {
              // 永不 settle，用于验证取消能中断
              await new Promise(() => {})
              return
            }
            if (step.kind === 'throw') throw new Error(step.message ?? 'boom')
            yield { type: 'text-delta', text: step.text ?? '{"enhancedPrompt":"x","openQuestions":[]}' }
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
    timeoutMs: 5000,
    temperature: 0.2,
    reasoningEffort: undefined,
    ...(script.config ?? {}),
  }
  return { provider: createDshModelProvider({ ctx, config, session: undefined }), calls }
}

test('resolveInitialBudget: config is a floor,估算可抬高，上限 16000', () => {
  assert.equal(resolveInitialBudget({ maxOutputTokens: 8192 }, '短'), 8192)
  assert.equal(resolveInitialBudget({ maxOutputTokens: 128 }, 'x'), 2002, '配置是下限')
  assert.equal(resolveInitialBudget({ maxOutputTokens: 8192 }, '字'.repeat(8000)), 16000, '超长输入封顶')
  assert.equal(resolveInitialBudget({ maxOutputTokens: Number.NaN }, ''), 8192, 'NaN 回退 8192')
})

test('一次 stop 只调用一次', async () => {
  const { provider, calls } = harness([{ kind: 'stop' }])
  const result = await provider.complete({ system: 's', user: 'u' })
  assert.equal(result.content.includes('enhancedPrompt'), true)
  assert.equal(calls.length, 1)
})

test('max-tokens 后用更大预算重试并成功', async () => {
  const { provider, calls } = harness([{ kind: 'max-tokens' }, { kind: 'stop' }])
  await provider.complete({ system: 's', user: 'u' })
  assert.equal(calls.length, 2)
  assert.ok(calls[1].maxTokens > calls[0].maxTokens, '第二轮预算应更大')
})

test('连续截断必须真的用满 16000 才报错', async () => {
  const { provider, calls } = harness([{ kind: 'max-tokens', config: { maxOutputTokens: 128 } }])
  await assert.rejects(() => provider.complete({ system: 's', user: 'u' }), /output cap even at 16000/)
  const budgets = calls.map(call => call.maxTokens)
  assert.equal(budgets[budgets.length - 1], 16000, `最后一次预算应是 16000，实际 ${budgets.join(',')}`)
  assert.ok(budgets.length >= 2)
})

test('非截断错误不重试', async () => {
  const { provider, calls } = harness([{ kind: 'throw', message: 'network down' }])
  await assert.rejects(() => provider.complete({ system: 's', user: 'u' }), /network down/)
  assert.equal(calls.length, 1)
})

test('tool-calls 映射为可读错误且不重试', async () => {
  const { provider, calls } = harness([{ kind: 'tool-calls' }])
  await assert.rejects(() => provider.complete({ system: 's', user: 'u' }), /tried to call a tool/)
  assert.equal(calls.length, 1)
})

test('取消后不再发起下一轮', async () => {
  const { provider, calls } = harness([{ kind: 'max-tokens' }])
  const controller = new AbortController()
  const promise = provider.complete({ system: 's', user: 'u', signal: controller.signal })
  // 第一轮返回 max-tokens 后立刻取消，重试前应被 assertAbort 拦下
  controller.abort(new Error('cancelled by user'))
  await assert.rejects(promise)
  assert.equal(calls.length, 1, `取消后不应再调用，实际调用 ${calls.length} 次`)
})

test('传入已取消的 signal 时一次都不调用', async () => {
  const { provider, calls } = harness([{ kind: 'stop' }])
  const controller = new AbortController()
  controller.abort(new Error('already cancelled'))
  await assert.rejects(() => provider.complete({ system: 's', user: 'u', signal: controller.signal }))
  assert.equal(calls.length, 0)
})
