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

test('PowerShell scripts are indexed as text files', async () => {
  // TEXT_EXTENSIONS 里存的是带点的扩展名，写成 'ps1' 会让 .ps1 永远匹配不上、
  // 整个脚本目录被当成二进制跳过。这条测试锁的就是那个点号。
  const root = { targetKey: 'root', displayPath: '/repo' }
  const scripts = { targetKey: 'scripts', displayPath: '/repo/scripts' }
  const deploy = { targetKey: 'deploy', displayPath: '/repo/scripts/deploy.ps1' }
  const fs = {
    async resolve(path) {
      if (path === '/repo') return root
      if (path === '/repo/scripts') return scripts
      throw new Error(`unexpected resolve ${path}`)
    },
    async listDir(target) {
      if (target.targetKey === 'root') return [{ name: 'scripts', type: 'directory', target: scripts }]
      return [{ name: 'deploy.ps1', type: 'file', target: deploy }]
    },
    async readText() {
      return 'Write-Host "deploy"\n'
    },
  }
  const config = readConfig({ context: { maxFiles: 5 } })
  const draft = parseMixedDraft('tidy up scripts/deploy.ps1')
  const context = await collectContext({
    fs,
    root: '/repo',
    session: createSession(),
    draft,
    config,
  })
  assert.equal(context.files.length, 1)
  assert.equal(context.files[0].path, '/repo/scripts/deploy.ps1')
})
