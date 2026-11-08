import assert from 'node:assert/strict'
import test from 'node:test'

import { detectDomains } from '../src/core/domains.js'
import { assessCompleteness } from '../src/core/completeness.js'
import { buildSystemPrompt } from '../src/core/prompt.js'

const CASES = [
  '帮我做个项目汇报 PPT',
  '把这份调研做成 15 页的答辩幻灯片',
  '用 Word 写一份实验室设备采购申请',
  '做个一页的求职简历',
  '把毕业论文按学校模板排版',
]

function evaluate(text) {
  const domains = detectDomains(text)
  const report = assessCompleteness({ draft: { originalText: text }, domains, locale: 'zh' })
  return { domains, report }
}

test('everyday deliverables reach the document domain', () => {
  for (const text of CASES) {
    const { domains } = evaluate(text)
    assert.equal(domains[0]?.id, 'document', `${text} -> ${domains[0]?.id ?? '-'}`)
  }
})

test('the document domain is judged, not merely recognised', () => {
  for (const text of CASES) {
    const { report } = evaluate(text)
    assert.equal(report.source, 'rule', text)
    assert.ok(report.gaps.length >= 5, `${text}: ${report.gaps.length}`)
    // 模板、结构与场合都属于「不先定就会返工」的阻塞项。
    assert.ok(report.gaps.some(gap => gap.dimension === 'format' && gap.severity === 'blocking'), text)
  }
})

test('the prompt carries the deck conventions for a slide request', () => {
  const text = '帮我做个项目汇报 PPT'
  const { domains, report } = evaluate(text)
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains,
    completeness: report,
    draftText: text,
  })
  assert.match(system, /类型与受众/u)
  assert.match(system, /先定页数与每页一句话结论/u)
  assert.match(system, /标题写结论而不是话题/u)
})

test('a paper-layout request gets its own conventions', () => {
  const text = '把毕业论文按学校模板排版'
  const { domains } = evaluate(text)
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains,
    draftText: text,
  })
  assert.match(system, /格式规范/u)
  assert.match(system, /参考文献与正文一一对应/u)
})
