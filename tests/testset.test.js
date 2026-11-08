import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { assessCompleteness } from '../src/core/completeness.js'
import { detectDomains } from '../src/core/domains.js'

// 把 tests/fixtures/testset.jsonl 的 49 条语料接进 CI。
//
// 这些语料原本只入库、没断言。这里断言的是「判定层」的行为：
// 领域命中与缺口报告是纯规则、可复现的，因此能作为自动验收基线。
// 模型改写质量不在断言范围内——那需要人工或下游任务成功率，不是单测能覆盖的。

const fixturePath = fileURLToPath(new URL('./fixtures/testset.jsonl', import.meta.url))
const rows = readFileSync(fixturePath, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line))

function draftOf(text) {
  return { originalText: text, naturalText: text }
}

function evaluate(row) {
  const domains = detectDomains(row.raw)
  return { domains, report: assessCompleteness({ draft: draftOf(row.raw), domains, locale: 'zh' }) }
}

function rowById(id) {
  const row = rows.find(entry => entry.id === id)
  assert.ok(row !== undefined, `missing corpus row: ${id}`)
  return row
}

test('the corpus keeps its expected shape', () => {
  assert.equal(rows.length, 49)
  const levels = new Set(rows.map(row => row.level))
  assert.deepEqual([...levels].sort(), ['E', 'L0', 'L1', 'L2', 'L3', 'L4', 'L5'])
  for (const row of rows) {
    assert.equal(typeof row.id, 'string')
    assert.equal(typeof row.raw, 'string')
    assert.equal(typeof row.expect, 'string')
  }
})

test('every entry yields a well-formed report and never throws', () => {
  for (const row of rows) {
    const { report } = evaluate(row)
    assert.equal(report.schemaVersion, 1, row.id)
    assert.ok(Number.isInteger(report.summary.totalSlots), row.id)
    assert.ok(report.coverage >= 0 && report.coverage <= 1, row.id)
    assert.ok(['rule', 'degraded'].includes(report.source), row.id)
    for (const gap of report.gaps) {
      assert.ok(['blocking', 'important', 'optional'].includes(gap.severity), row.id)
      assert.equal(typeof gap.question, 'string', row.id)
      assert.ok(gap.question.length > 0, row.id)
      assert.ok(Array.isArray(gap.missingSlots), row.id)
    }
  }
})

test('noise entries never invent a domain', () => {
  const noise = rows.filter(row => row.domain === 'noise')
  assert.equal(noise.length, 4)
  for (const row of noise) {
    const { domains, report } = evaluate(row)
    assert.deepEqual(domains, [], row.id)
    assert.equal(report.source, 'degraded', row.id)
    assert.deepEqual(report.gaps, [], row.id)
  }
})

test('mechanical and engineering entries always reach a domain', () => {
  const mechanical = rows.filter(row => row.domain === '机械/工程')
  assert.ok(mechanical.length >= 5, String(mechanical.length))
  for (const row of mechanical) {
    const { domains } = evaluate(row)
    assert.ok(domains.length > 0, `${row.id} ${row.raw.slice(0, 30)}`)
  }
})

test('a bare mechanical noun reaches the mechanical domain', () => {
  const { domains } = evaluate(rowById('L1-01'))
  assert.deepEqual(domains.map(domain => domain.id), ['mechanical'])
})

test('everyday words do not trigger the mechanical domain', () => {
  for (const id of ['L1-04', 'L1-05', 'L1-06']) {
    const row = rowById(id)
    const { domains } = evaluate(row)
    assert.equal(domains.some(domain => domain.id === 'mechanical'), false, `${id} ${row.raw}`)
  }
})

test('a bare mechanical noun reports the blocking gaps it must specify', () => {
  const { report } = evaluate(rowById('L1-01'))
  assert.equal(report.source, 'rule')
  assert.ok(report.gaps.length > 0)
  assert.equal(report.gaps[0].severity, 'blocking')
  assert.ok(report.gaps.some(gap => gap.id === 'mechanical.material'))
  assert.ok(report.gaps.some(gap => gap.id === 'mechanical.geometry'))
})

test('more specifying information never lowers coverage', () => {
  const sparse = evaluate(rowById('A1')).report
  const rich = evaluate(rowById('A5')).report
  assert.ok(rich.coverage >= sparse.coverage, `${sparse.coverage} -> ${rich.coverage}`)
})

test('adversarial entries are handled without throwing', () => {
  const adversarial = rows.filter(row => row.level === 'E')
  assert.equal(adversarial.length, 10)
  for (const row of adversarial) {
    const { report } = evaluate(row)
    assert.equal(report.schemaVersion, 1, row.id)
    assert.equal(typeof report.source, 'string', row.id)
  }
})

test('the evaluation is deterministic across the whole corpus', () => {
  for (const row of rows) {
    assert.deepEqual(evaluate(row).report, evaluate(row).report, row.id)
  }
})
