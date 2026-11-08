import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const binPath = join(projectRoot, 'bin', 'dsh-prompt-weaver.js')

function runCli(args) {
  return spawnSync(process.execPath, [binPath, ...args], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
}

test('CLI enhance runs offline and emits JSON', () => {
  const result = runCli([
    'enhance',
    '--input',
    'examples/input/mixed.txt',
    '--context',
    'examples/context/workspace.json',
    '--json',
  ])
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.ok, true)
  assert.equal(payload.text.startsWith('/prompt'), true)
  assert.ok(payload.text.includes('@src/app.ts'))
  assert.equal(payload.quality.passed, true)
})

test('CLI frameworks validate accepts bundled examples', () => {
  const result = runCli(['frameworks', 'validate', 'examples/frameworks'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /ok: 2 framework file\(s\) valid/u)
})

test('CLI config export contains preferences and custom frameworks', () => {
  const result = runCli(['config', 'export', '--config', 'examples/config/dsh-prompt-weaver.config.json', '--json'])
  assert.equal(result.status, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.kind, 'dsh-prompt-weaver.config')
  assert.equal(payload.preferences.mode, 'standard')
  assert.equal(Array.isArray(payload.frameworks), true)
})

test('CLI blocks sensitive drafts without echoing the secret', () => {
  const result = runCli(['enhance', 'Use api_key=sk-abcdef1234567890abcdef to fix the build'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /sensitive-draft/u)
  assert.equal(result.stderr.includes('sk-abcdef1234567890abcdef'), false)
})

test('CLI compare prints a deterministic report', () => {
  const result = runCli(['compare', 'examples/input/basic.txt', 'examples/input/basic.txt'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /delta/u)
})

test('CLI context honours the same byte budget as the host', () => {
  // 以前 CLI 自己读 context.json、自己脱敏，绕过了 maxTotalBytes：
  // 一份 40KB 的文件加 40KB 的会话会原样送进引擎。
  const file = join(tmpdir(), `weaver-context-${process.pid}-${Date.now()}.json`)
  writeFileSync(file, JSON.stringify({
    files: [{ path: 'src/a.ts', content: 'x'.repeat(40000) }],
    conversation: [{ role: 'user', text: 'y'.repeat(40000) }],
    tree: Array.from({ length: 400 }, (_, index) => `dir${index}/`),
  }))
  try {
    const result = runCli(['enhance', '--input', 'examples/input/basic.txt', '--context', file, '--json'])
    assert.equal(result.status, 0, result.stderr)
    const payload = JSON.parse(result.stdout)
    assert.ok(payload.context.totalBytes <= 16384, `context total ${payload.context.totalBytes} exceeded the default budget`)
  } finally {
    rmSync(file, { force: true })
  }
})
