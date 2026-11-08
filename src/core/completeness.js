import { pickSlots } from './domains.js'
import { probeFor, SEVERITY_ORDER } from './dimension-probes.js'
import { freezeDeep } from './utils.js'

// 需求完备性检查：判断「这类任务执行前必须答清的东西，用户说了几成」。
//
// 设计取舍：
// - 纯规则、无 IO、无随机、不读时钟。同一输入必须逐字节同输出，否则无法作为验收基线。
// - 只读：不改 draft、不改 analysis、不改 domains。
// - 永不抛业务异常：判不出来就返回降级报告，让增强主流程照常跑。
// - 没有登记探针的维度一律「不判定」而不是「全部缺失」——宁可少报，不能凭空要东西。
// - 只检查主领域：detectDomains 已按命中分数排序，次要领域多半是词面巧合，
//   一并检查会把覆盖率摊薄，也会问出与任务无关的维度。

const MAX_TEXT_CHARS = 20000
const compiled = new Map()

function compile(source) {
  const cached = compiled.get(source)
  if (cached !== undefined) return cached
  let pattern = null
  try {
    pattern = new RegExp(source, 'iu')
  } catch {
    // 探针写错不该让整次检查失败，跳过这一条即可。
    pattern = null
  }
  compiled.set(source, pattern)
  return pattern
}

function firstMatch(text, sources) {
  if (!Array.isArray(sources)) return null
  for (const source of sources) {
    const pattern = compile(source)
    if (pattern === null) continue
    const found = pattern.exec(text)
    if (found !== null) return String(found[0]).slice(0, 60)
  }
  return null
}

function emptyReport(source = 'degraded') {
  return freezeDeep({
    schemaVersion: 1,
    coverage: 0,
    gaps: [],
    covered: [],
    summary: { blocking: 0, important: 0, optional: 0, totalSlots: 0, coveredSlots: 0 },
    source,
  })
}

export function assessCompleteness({ draft, domains, locale = 'zh' } = {}) {
  const raw = typeof draft?.originalText === 'string' ? draft.originalText : ''
  const text = raw.slice(0, MAX_TEXT_CHARS)
  if (text.trim().length === 0) return emptyReport()
  if (!Array.isArray(domains) || domains.length === 0) return emptyReport()

  const primary = domains[0]
  const dimensions = Array.isArray(primary?.dimensions) ? primary.dimensions : []
  if (dimensions.length === 0) return emptyReport()

  const gaps = []
  const coveredDimensions = []
  const summary = { blocking: 0, important: 0, optional: 0 }
  let totalSlots = 0
  let coveredSlots = 0

  for (const dimension of dimensions) {
    const probe = probeFor(primary.id, dimension.id)
    if (probe === undefined) continue
    const labels = pickSlots(dimension.slots, locale)
    if (labels.length === 0) continue

    const slots = []
    let missing = 0
    for (const label of labels) {
      const sources = probe.slots?.[label]
      if (sources === undefined) continue
      totalSlots += 1
      const evidence = firstMatch(text, sources)
      if (evidence === null) missing += 1
      else coveredSlots += 1
      slots.push({ id: label, label, status: evidence === null ? 'missing' : 'covered', evidence })
    }
    if (slots.length === 0) continue

    if (missing === 0) {
      coveredDimensions.push({
        id: `${primary.id}.${dimension.id}`,
        domain: primary.id,
        dimension: dimension.id,
        matchedSlots: slots.map(slot => slot.label),
      })
      continue
    }

    const severity = typeof probe.severity === 'string' && SEVERITY_ORDER[probe.severity] !== undefined
      ? probe.severity
      : 'important'
    summary[severity] += 1
    gaps.push({
      id: `${primary.id}.${dimension.id}`,
      domain: primary.id,
      dimension: dimension.id,
      severity,
      question: locale === 'zh' ? (dimension.zh ?? dimension.en ?? dimension.id) : (dimension.en ?? dimension.zh ?? dimension.id),
      missingSlots: slots.filter(slot => slot.status === 'missing').map(slot => slot.label),
      slots,
      source: primary.planned === true ? 'planned' : 'builtin',
    })
  }

  // 有领域、有维度，但一个探针都没配上：这不是「没有缺口」，
  // 而是「还没能力判断」。混为一谈会让用户以为这一项检查过了。
  if (totalSlots === 0) return emptyReport('unprobed')

  gaps.sort((left, right) => {
    const bySeverity = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    return bySeverity !== 0 ? bySeverity : left.id.localeCompare(right.id)
  })

  return freezeDeep({
    schemaVersion: 1,
    coverage: Math.round((coveredSlots / totalSlots) * 100) / 100,
    gaps,
    covered: coveredDimensions,
    summary: { ...summary, totalSlots, coveredSlots },
    source: 'rule',
  })
}
