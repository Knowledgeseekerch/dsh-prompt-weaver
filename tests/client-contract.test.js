import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const clientPath = fileURLToPath(new URL('../client.js', import.meta.url))
const source = readFileSync(clientPath, 'utf8')

test('client registers the composer slot and public RPC endpoints', () => {
  assert.match(source, /conversation\.input\.right/u)
  assert.match(source, /promptWeaver\/enhance/u)
  assert.match(source, /promptWeaver\/listFrameworks/u)
  assert.match(source, /promptWeaver\/importConfig/u)
  assert.match(source, /promptWeaver\/exportConfig/u)
})

test('client preserves attachments and slash-command input instead of rejecting it', () => {
  assert.match(source, /attachmentIds/u)
  assert.match(source, /attachmentCount/u)
  assert.match(source, /inferCommand/u)
  assert.match(source, /requestBase/u)
  assert.equal(/innerHTML/u.test(source), false)
})

test('client does not auto-submit or persist prompt text', () => {
  assert.equal(/localStorage/u.test(source), false)
  assert.equal(/sessionStorage/u.test(source), false)
  assert.equal(/\.submit\(/u.test(source), false)
  assert.match(source, /inputActions\.setDraft/u)
})

test('both enhancement paths share one write-back gate', () => {
  // 面板与一键增强必须过同一个 canApplyResult：只要其中一条漏掉，
  // 用户就能从那条路径把带违规的结果直接盖进输入框，门禁形同虚设。
  const sites = source.match(/canApplyResult\(/gu) ?? []
  assert.ok(sites.length >= 3, `expected one definition and two call sites, saw ${sites.length}`)
  assert.match(source, /if \(!canApplyResult\(value\)\)/u)
})

test('the result panel shows assumptions and open questions instead of bare counts', () => {
  assert.match(source, /renderAssumptions\(/u)
  // openQuestions 是 { question, reason } 对象，直接 String() 会渲染成 [object Object]。
  assert.match(source, /openQuestionText\(/u)
})

test('the panel renders outside the composer slot and right click does nothing', () => {
  // slot 容器会建立包含块，把 position:fixed 压成按钮的 28px 见方：
  // 面板不挂到 body 上，全屏遮罩就会变成盖住按钮的一个黑点。
  assert.match(source, /createPortal/u)
  assert.match(source, /onContextMenu: event => event\.preventDefault\(\)/u)
  assert.equal(/onContextMenu: event => \{\s*event\.preventDefault\(\)\s*setOpen/u.test(source), false)
  // 渲染失败时由错误边界兜住，按钮不能跟着面板一起消失。
  assert.match(source, /class PanelBoundary extends React\.Component/u)
  assert.match(source, /getDerivedStateFromError/u)
})

test('the inline dictionaries keep the same keys in both languages', () => {
  // locale/*.json 只是残缺副本（7 个键，且无人读取），已删除：
  // client.js 的内联字典是唯一文案来源。这里锁住 en/zh 键集合一致，
  // 防止新增文案只补一边——0.2.14 加 copy 系列时就漏过一次。
  const keysOf = (name) => {
    const start = source.indexOf(`const ${name} = {`)
    assert.ok(start > 0, `missing dictionary: ${name}`)
    const end = source.indexOf('\n    }', start)
    assert.ok(end > start, `unterminated dictionary: ${name}`)
    const block = source.slice(start, end)
    return [...block.matchAll(/^\s{6}([A-Za-z_][A-Za-z0-9_]*):/gmu)].map(match => match[1]).sort()
  }
  const en = keysOf('en')
  const zh = keysOf('zh')
  assert.ok(en.length > 40, `expected a full dictionary, saw ${en.length} keys`)
  assert.deepEqual(zh, en)
})
