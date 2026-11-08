import assert from 'node:assert/strict'
import test from 'node:test'

import { createHostService } from '../src/host/service.js'
import { createPromptWeaverEngine } from '../src/core/engine.js'
import { createFrameworkStore } from '../src/core/frameworks.js'
import { readConfig } from '../src/core/config.js'
import { createStaticModelProvider } from '../src/core/provider.js'

/** 最小 ctx：只提供 engine 需要的服务。 */
function makeService() {
  const ctx = {
    get: (name) => (name === 'llm' ? undefined : undefined),
    logger: { warn() {} },
  }
  const engine = createPromptWeaverEngine({
    config: readConfig(),
    frameworkStore: createFrameworkStore(),
    provider: createStaticModelProvider([JSON.stringify({
      enhancedPrompt: '打开抖音并对内容点赞。',
      openQuestions: [],
      assumptions: [],
      usedContext: [],
    })]),
    contextProvider: () => ({
      projectAvailable: false,
      files: [],
      tree: [],
      conversation: [],
      conversationMessages: 0,
      redactions: [],
      totalBytes: 0,
    }),
    logger: { warn() {} },
  })
  const service = createHostService({
    ctx,
    config: readConfig(),
    frameworkStore: createFrameworkStore(),
    engine,
    logger: { warn() {} },
  })
  return service
}

const agent = { session: { header: { cwd: '/repo' } } }

test('an enhancement is stored and can be taken exactly once', async () => {
  const service = makeService()
  const result = await service.enhance(agent, { text: '打开抖音并点赞', clientKey: 's1' }, new AbortController().signal)
  assert.equal(result.ok, true)

  const taken = await service.takePending({ clientKey: 's1' })
  assert.equal(taken.ok, true)
  assert.equal(taken.result?.text, result.text)

  const again = await service.takePending({ clientKey: 's1' })
  assert.equal(again.result, null, '取走后不应再返回同一份结果')
})

test('clearPending drops the stored result', async () => {
  const service = makeService()
  await service.enhance(agent, { text: '打开抖音并点赞', clientKey: 's2' }, new AbortController().signal)
  await service.clearPending({ clientKey: 's2' })
  const taken = await service.takePending({ clientKey: 's2' })
  assert.equal(taken.result, null)
})

test('pending results are keyed per session', async () => {
  const service = makeService()
  await service.enhance(agent, { text: '打开抖音并点赞', clientKey: 'a' }, new AbortController().signal)
  await service.enhance(agent, { text: '讲一下 PID', clientKey: 'b' }, new AbortController().signal)

  const fromA = await service.takePending({ clientKey: 'a' })
  const fromB = await service.takePending({ clientKey: 'b' })
  assert.notEqual(fromA.result?.text, fromB.result?.text)
  assert.equal((await service.takePending({ clientKey: 'c' })).result, null)
})

test('a request without clientKey stores nothing', async () => {
  const service = makeService()
  await service.enhance(agent, { text: '打开抖音并点赞' }, new AbortController().signal)
  assert.equal((await service.takePending({ clientKey: undefined })).result, null)
})
