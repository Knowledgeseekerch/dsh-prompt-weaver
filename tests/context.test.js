import assert from 'node:assert/strict'
import test from 'node:test'

import { collectContext } from '../src/core/context.js'
import { readConfig } from '../src/core/config.js'
import { parseMixedDraft } from '../src/core/draft.js'

const fixtureSecret = ['sk', 'abcdef1234567890abcdef'].join('-')

function createFsFixture() {
  const root = { targetKey: 'root', displayPath: '/repo' }
  const src = { targetKey: 'src', displayPath: '/repo/src' }
  const files = {
    app: { targetKey: 'app', displayPath: '/repo/src/app.ts' },
    readme: { targetKey: 'readme', displayPath: '/repo/README.md' },
    secret: { targetKey: 'secret', displayPath: '/repo/.env' },
    binary: { targetKey: 'binary', displayPath: '/repo/src/binary.bin' },
  }
  const listing = {
    root: [
      { name: 'src', type: 'directory', target: src },
      { name: 'README.md', type: 'file', target: files.readme },
      { name: '.env', type: 'file', target: files.secret },
      { name: 'node_modules', type: 'directory', target: { targetKey: 'ignored' } },
    ],
    src: [
      { name: 'app.ts', type: 'file', target: files.app },
      { name: 'binary.bin', type: 'file', target: files.binary },
    ],
  }
  const contents = {
    app: 'export const login = "app"\n',
    readme: '# Fixture\n',
    secret: `API_KEY=${fixtureSecret}\n`,
    binary: 'binary\u0000content',
  }
  return {
    async resolve(path) {
      if (path === '/repo') return root
      if (path === '/repo/src') return src
      throw new Error(`unexpected resolve ${path}`)
    },
    async listDir(target) {
      if (target.targetKey === 'root') return listing.root
      if (target.targetKey === 'src') return listing.src
      return []
    },
    async readText(target) {
      if (contents[target.targetKey] === undefined) throw new Error(`unexpected read ${target.targetKey}`)
      return contents[target.targetKey]
    },
  }
}

function createSession() {
  return {
    header: { cwd: '/repo' },
    events: [
      { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'The login button does nothing.' }] } },
      { type: 'assistant/message', data: { message: { source: { kind: 'model' }, content: [{ type: 'text', text: 'Assistant text excluded by default.' }] } } },
      { type: 'user/message', data: { source: { kind: 'plugin' }, content: [{ type: 'text', text: 'Synthetic skill body excluded.' }] } },
      { type: 'tool/call', data: { name: 'read_file', arguments: JSON.stringify({ file_path: '/repo/src/app.ts' }) } },
    ],
    snapshotEvents() {
      return this.events
    },
  }
}

test('context collector selects grounded files and redacts secrets', async () => {
  const config = readConfig({ context: { maxFiles: 3 } })
  const draft = parseMixedDraft('fix @src/app.ts and read README.md')
  const context = await collectContext({
    fs: createFsFixture(),
    root: '/repo',
    session: createSession(),
    draft,
    config,
  })
  assert.equal(context.projectAvailable, true)
  const paths = context.files.map(file => file.path)
  assert.ok(paths.includes('/repo/src/app.ts'))
  assert.ok(paths.includes('/repo/README.md'))
  assert.equal(paths.some(path => path.includes('.env')), false)
  assert.equal(context.files.some(file => file.content.includes(fixtureSecret)), false)
  assert.equal(context.conversationMessages, 1)
  assert.equal(context.conversation[0].text, 'The login button does nothing.')
})

test('context collector degrades when fs is unavailable', async () => {
  const config = readConfig()
  const draft = parseMixedDraft('fix the login button')
  const context = await collectContext({
    fs: undefined,
    root: '/repo',
    session: createSession(),
    draft,
    config,
  })
  assert.equal(context.projectAvailable, false)
  assert.equal(context.files.length, 0)
  assert.equal(context.conversationMessages, 1)
})

test('context collector redacts assistant messages only when opted in', async () => {
  const config = readConfig({ includeAssistantMessages: true, maxConversationMessages: 5 })
  const draft = parseMixedDraft('fix the login button')
  const context = await collectContext({
    fs: createFsFixture(),
    root: '/repo',
    session: createSession(),
    draft,
    config,
  })
  assert.equal(context.conversationMessages, 2)
  assert.equal(context.conversation.some(message => message.role === 'assistant'), true)
})
