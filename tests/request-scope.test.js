import assert from 'node:assert/strict'
import test from 'node:test'

import { currentScope, runWithScope } from '../src/host/request-scope.js'

const tick = (ms) => new Promise(resolve => setTimeout(resolve, ms))

test('currentScope is undefined outside a request', () => {
  assert.equal(currentScope(), undefined)
})

test('each request keeps its own scope while awaiting', async () => {
  // 关键场景：A 先进入并 await，B 在 A 的 await 期间进入并完成。
  // 共享可变字段在这个顺序下必然串；作用域不会。
  const [a, b] = await Promise.all([
    runWithScope({ session: 'A' }, async () => {
      await tick(20)
      return currentScope()?.session
    }),
    runWithScope({ session: 'B' }, async () => {
      await tick(1)
      return currentScope()?.session
    }),
  ])
  assert.equal(a, 'A')
  assert.equal(b, 'B')
})

test('nested scopes shadow the outer one and restore it afterwards', async () => {
  await runWithScope({ session: 'outer' }, async () => {
    assert.equal(currentScope()?.session, 'outer')
    await runWithScope({ session: 'inner' }, async () => {
      await tick(1)
      assert.equal(currentScope()?.session, 'inner')
    })
    assert.equal(currentScope()?.session, 'outer')
  })
})

test('scope does not leak to concurrent unrelated work', async () => {
  const observed = []
  await Promise.all([
    runWithScope({ session: 'scoped' }, async () => {
      await tick(5)
      observed.push(currentScope()?.session ?? 'none')
    }),
    (async () => {
      await tick(1)
      observed.push(currentScope()?.session ?? 'none')
    })(),
  ])
  assert.deepEqual(observed.sort(), ['none', 'scoped'])
})
