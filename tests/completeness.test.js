import assert from 'node:assert/strict'
import test from 'node:test'

import { assessCompleteness } from '../src/core/completeness.js'
import { detectDomains } from '../src/core/domains.js'

function draftOf(text) {
  return { originalText: text, naturalText: text }
}

function report(text, locale = 'zh') {
  return assessCompleteness({ draft: draftOf(text), domains: detectDomains(text), locale })
}

test('empty draft degrades instead of throwing', () => {
  const result = assessCompleteness({ draft: draftOf(''), domains: detectDomains('place'), locale: 'zh' })
  assert.equal(result.source, 'degraded')
  assert.deepEqual(result.gaps, [])
  assert.equal(result.coverage, 0)
})

test('a draft with no domain hit produces no gaps', () => {
  const result = report('你好')
  assert.equal(result.source, 'degraded')
  assert.deepEqual(result.gaps, [])
})

test('a missing domains argument degrades', () => {
  const result = assessCompleteness({ draft: draftOf('帮我画个支架') })
  assert.equal(result.source, 'degraded')
  assert.deepEqual(result.gaps, [])
})

test('a bare mechanical draft exposes the blocking gaps', () => {
  const result = report('帮我画个支架')
  assert.equal(result.source, 'rule')
  assert.equal(result.coverage, 0)
  const ids = result.gaps.map(gap => gap.id)
  assert.ok(ids.includes('mechanical.geometry'))
  assert.ok(ids.includes('mechanical.material'))
  assert.ok(ids.includes('mechanical.tolerance'))
  assert.deepEqual(
    result.gaps.filter(gap => gap.severity === 'blocking').map(gap => gap.id),
    ['mechanical.geometry', 'mechanical.material', 'mechanical.tolerance'],
  )
})

test('blocking gaps sort before important and optional', () => {
  const result = report('帮我画个支架')
  const rank = { blocking: 0, important: 1, optional: 2 }
  const actual = result.gaps.map(gap => rank[gap.severity])
  assert.deepEqual(actual, [...actual].sort((left, right) => left - right))
})

test('stated facts raise coverage and clear their slots', () => {
  const result = report('做一个200x120的Q235支架，板厚8，焊接')
  assert.equal(result.source, 'rule')
  assert.equal(result.summary.coveredSlots, 4)
  assert.equal(result.coverage, 0.18)
  const geometry = result.gaps.find(gap => gap.id === 'mechanical.geometry')
  assert.deepEqual(geometry.missingSlots, ['基准'])
  const material = result.gaps.find(gap => gap.id === 'mechanical.material')
  assert.deepEqual(material.missingSlots, ['热处理', '表面处理'])
})

test('a fully described dimension leaves gaps and lands in covered', () => {
  const domains = [{
    id: 'mechanical',
    dimensions: [{
      id: 'inspection',
      zh: '检验判据：量具、合格判据',
      en: 'inspection: instrument, acceptance criterion',
      slots: { zh: ['量具', '合格判据'], en: ['instrument', 'acceptance criterion'] },
    }],
  }]
  const result = assessCompleteness({ draft: draftOf('用卡尺测，公差范围内算合格'), domains, locale: 'zh' })
  assert.equal(result.gaps.length, 0)
  assert.equal(result.covered.length, 1)
  assert.equal(result.covered[0].id, 'mechanical.inspection')
  assert.equal(result.coverage, 1)
})

test('dimensions without a registered probe are not judged', () => {
  const domains = [{
    id: 'research',
    dimensions: [{ id: 'scope', zh: '检索范围', en: 'scope', slots: { zh: ['来源'], en: ['sources'] } }],
  }]
  const result = assessCompleteness({ draft: draftOf('帮我调研一下'), domains, locale: 'zh' })
  assert.equal(result.source, 'rule')
  assert.deepEqual(result.gaps, [])
  assert.equal(result.summary.totalSlots, 0)
})

test('the same draft always produces the same report', () => {
  const text = '帮我画个法兰盘，材料6061，公差H7'
  assert.deepEqual(report(text), report(text))
})

test('the draft is never mutated', () => {
  const draft = draftOf('帮我画个支架')
  const before = JSON.stringify(draft)
  assessCompleteness({ draft, domains: detectDomains(draft.originalText), locale: 'zh' })
  assert.equal(JSON.stringify(draft), before)
})

test('the report and its nested collections are frozen', () => {
  const result = report('帮我画个支架')
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.gaps), true)
  assert.equal(Object.isFrozen(result.covered), true)
})

test('every slot status is covered or missing', () => {
  const result = report('做一个200x120的Q235支架')
  for (const gap of result.gaps) {
    for (const slot of gap.slots) {
      assert.ok(slot.status === 'covered' || slot.status === 'missing', slot.status)
      assert.equal(typeof slot.label, 'string')
    }
  }
})

test('english locale returns english dimension text', () => {
  const result = assessCompleteness({
    draft: draftOf('draw a bracket'),
    domains: detectDomains('draw a bracket'),
    locale: 'en',
  })
  if (result.source === 'rule') {
    for (const gap of result.gaps) assert.equal(typeof gap.question, 'string')
  }
})
