import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, createTypertDescriptor } from '../index.js'

function createFs() {
  const root = { targetKey: 'root', displayPath: '/repo' }
  const src = { targetKey: 'src', displayPath: '/repo/src' }
  const app = { targetKey: 'app', displayPath: '/repo/src/app.ts' }
  const readme = { targetKey: 'readme', displayPath: '/repo/README.md' }
  const listing = {
    root: [
      { name: 'src', type: 'directory', target: src },
      { name: 'README.md', type: 'file', target: readme },
    ],
    src: [{ name: 'app.ts', type: 'file', target: app }],
  }
  const contents = {
    app: 'export function submit() { return false }\n',
    readme: '# Fixture\n',
  }
  return {
    async resolve(path) {
      if (path === '/repo') return root
      if (path === '/repo/src') return src
      throw new Error(`unexpected resolve ${path}`)
    },
    async listDir(target) {
      return target.targetKey === 'root' ? listing.root : listing.src
    },
    async readText(target) {
      return contents[target.targetKey]
    },
  }
}

function createSession() {
  return {
    header: { cwd: '/repo' },
    events: [
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'The login button does nothing.' }] } },
    ],
    requestHeader() {
      return { config: { provider: 'fixture', model: 'fixture-model' } }
    },
    snapshotEvents() {
      return this.events
    },
  }
}

function createContext() {
  const state = {
    provided: new Map(),
    typert: undefined,
    llmOptions: undefined,
    loggedWarnings: [],
  }
  const ctx = {
    logger: {
      warn(...args) {
        state.loggedWarnings.push(args.join(' '))
      },
    },
    provide(name, value) {
      state.provided.set(name, value)
      return () => state.provided.delete(name)
    },
    inject(names, callback) {
      assert.deepEqual(names, ['typert'])
      callback({
        typert: {
          register(contribution) {
            state.typert = contribution
            return () => {}
          },
        },
      })
    },
    get(name) {
      if (name === 'llm') {
        return {
          async *stream(options) {
            state.llmOptions = options
            const output = JSON.stringify({
              enhancedPrompt: '/prompt fix @src/app.ts. 不要修改数据库。',
              openQuestions: [],
              assumptions: [],
              usedContext: ['file:1'],
            })
            yield { type: 'text-delta', text: output }
            yield { type: 'finish', reason: { kind: 'completed' } }
          },
        }
      }
      if (name === 'fs') return createFs()
      if (name === 'workingDirectory') return { get: () => '/repo' }
      if (name === 'agentDefaultModel') {
        return { currentSelection: () => ({ provider: 'default', model: 'default-model' }) }
      }
      return undefined
    },
  }
  return { ctx, state }
}

test('host plugin registers the service and Remote descriptor', () => {
  const { ctx, state } = createContext()
  apply(ctx, {})
  assert.equal(state.provided.has('promptWeaver'), true)
  assert.equal(state.typert.package, 'dsh-prompt-weaver')
  assert.equal(state.typert.face, 'host')
  assert.equal(state.typert.invocations.length, 4)
  assert.equal(state.typert.invocations[0].id, 'dsh-prompt-weaver#promptWeaver/enhance')
  assert.equal(state.typert.invocations[0].namespace, 'promptWeaver')
  assert.equal(state.typert.invocations[0].parameters[0].lookup, 'agent')
})

test('host service enhances a mixed draft through the DSH llm seam', async () => {
  const { ctx, state } = createContext()
  apply(ctx, {})
  const service = state.provided.get('promptWeaver')
  const agent = { session: createSession() }
  const result = await service.enhance(agent, {
    text: '/prompt fix @src/app.ts. 不要修改数据库。',
  }, new AbortController().signal)

  assert.equal(result.ok, true)
  assert.equal(result.text.startsWith('/prompt'), true)
  assert.ok(result.text.includes('@src/app.ts'))
  assert.ok(result.text.includes('不要修改数据库'))
  assert.equal(result.quality.passed, true)
  // DSH 的 GenerateOptions.purpose 只有 'compaction' | 'session-title'，
  // 这里断言不传，避免使用未定义的取值。
  assert.equal(state.llmOptions.purpose, undefined)
  assert.equal(state.llmOptions.provider, 'fixture')
  assert.equal(state.llmOptions.model, 'fixture-model')
  assert.equal(result.context.projectAvailable, true)
  assert.ok(result.context.filePaths.includes('/repo/src/app.ts'))
  assert.equal(result.context.conversationMessages, 1)
  assert.equal(result.model.provider, 'fixture')
})

test('host service reports command-only drafts as a readable failure', async () => {
  const { ctx, state } = createContext()
  apply(ctx, {})
  const service = state.provided.get('promptWeaver')
  const agent = { session: createSession() }
  const result = await service.enhance(agent, { text: '/compact' }, new AbortController().signal)
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'command-only')
})

test('host service lists frameworks and round-trips configuration', async () => {
  const { ctx, state } = createContext()
  apply(ctx, {})
  const service = state.provided.get('promptWeaver')
  const agent = { session: createSession() }

  const list = await service.listFrameworks()
  assert.equal(list.ok, true)
  assert.ok(list.frameworks.some(framework => framework.id === 'general'))

  const exported = await service.exportConfig()
  assert.equal(exported.ok, true)
  assert.equal(exported.bundle.kind, 'dsh-prompt-weaver.config')

  const imported = await service.importConfig(agent, {
    bundle: {
      schemaVersion: 1,
      kind: 'dsh-prompt-weaver.config',
      preferences: {},
      frameworks: [],
    },
    conflict: 'skip',
  }, new AbortController().signal)
  assert.equal(imported.ok, true)
})

test('typert descriptor declares cancellation and direct invocations', () => {
  const descriptor = createTypertDescriptor()
  const enhance = descriptor.invocations.find(item => item.method === 'enhance')
  assert.equal(enhance.invocation.kind, 'direct')
  assert.deepEqual(enhance.cancellation, { parameter: 'signal' })
  assert.equal(enhance.result.mode, 'src-json')
})
