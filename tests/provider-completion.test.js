import assert from 'node:assert/strict'
import test from 'node:test'

import { createDshModelProvider, isAbortError } from '../src/core/provider.js'

function providerWith(events) {
  const ctx = {
    get(name) {
      if (name === 'llm') {
        return {
          async *stream() {
            yield* events
          },
        }
      }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
      return undefined
    },
  }
  return createDshModelProvider({
    ctx,
    config: {
      maxOutputTokens: 100,
      maxOutputTokensCap: 100,
      timeoutMs: 5000,
      temperature: 0.2,
      reasoningEffort: undefined,
    },
    session: undefined,
  })
}

test('a stream that ends without a finish event is not treated as a complete result', async () => {
  // 语法上恰好完整的一行 JSON，但流被掐断了：不能静默当成完整结果。
  const provider = providerWith([{ type: 'text-delta', text: '{"enhancedPrompt":"x"}' }])
  await assert.rejects(
    () => provider.complete({ system: 's', user: 'u' }),
    /without a finish event/u,
  )
})

test('a stream that reports finish is accepted', async () => {
  const provider = providerWith([
    { type: 'text-delta', text: '{"enhancedPrompt":"x","openQuestions":[]}' },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  const result = await provider.complete({ system: 's', user: 'u' })
  assert.match(result.content, /enhancedPrompt/u)
})

test('cancel shapes other than AbortError are recognised as cancellation', () => {
  assert.equal(isAbortError({ name: 'AbortError' }), true)
  assert.equal(isAbortError({ name: 'CanceledError' }), true)
  assert.equal(isAbortError({ code: 'ERR_CANCELED' }), true)
  assert.equal(isAbortError({ name: 'DOMException', code: 20 }), true)
  assert.equal(isAbortError({ message: 'The operation was aborted.' }), true)
  // 普通失败不能被认成取消，否则真实错误会被静默吞掉。
  assert.equal(isAbortError({ name: 'TypeError', message: 'fetch failed' }), false)
  assert.equal(isAbortError(undefined), false)
})
