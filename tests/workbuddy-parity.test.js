import assert from 'node:assert/strict'
import test from 'node:test'

import { blueprintFor } from '../src/core/blueprints.js'
import { detectDomains, describeDimensions, pickSlots } from '../src/core/domains.js'
import { DIMENSION_PROBES } from '../src/core/dimension-probes.js'
import { buildSystemPrompt } from '../src/core/prompt.js'

// 对标：一份强答案会覆盖的工程要素。
//
// 这里的 mustCover 取自三条真实的高质量增强输出（WorkBuddy 的成品）里
// 反复出现的工程要件。断言的目的不是照抄它的措辞，而是证明本插件掌握的
// 领域知识足以把这些要件落成「必答槽位或骨架」，而不是漏掉其中一半。
const CASES = [
  {
    raw: '用 STM32 读取热电偶温度，实现完整的温度采集功能',
    domain: 'hardware',
    mustCover: ['信号调理', '采样', '标定', '补偿', '滤波', '误差'],
  },
  {
    raw: '用 Flask 实现一个登录页面，包含用户名和密码输入表单、身份验证逻辑与登录成功失败提示',
    domain: 'software',
    mustCover: ['路由', '模板', '会话', '校验', '错误处理'],
  },
  {
    raw: '使用 STM32 编写嵌入式 C 代码实现 PID 温度控制系统，通过 ADC 采集热电偶并经 PWM 驱动加热',
    domain: 'hardware',
    mustCover: ['ADC', 'PWM', 'PID', '初始化', '引脚'],
  },
  {
    raw: '读取并合并指定的三个 CSV 文件为一张表，按行纵向拼接，删除完全重复的行，输出新文件并说明合并后的总行数与移除的重复行数量',
    domain: 'data',
    mustCover: ['行数', '重复', '列结构'],
  },
  {
    raw: '帮我系统化排查电脑蓝屏故障，先列需要收集的关键信息，再给从软件到硬件的渐进式排查流程',
    domain: 'diagnosis',
    mustCover: ['停止码', '频率', '驱动', '日志', '内存', '安全模式'],
  },
]

/** 把该领域掌握的全部知识拼成一段可检索文本：维度、槽位、探针、骨架。 */
function knowledgeOf(domains, locale = 'zh') {
  const parts = [...describeDimensions(domains, locale)]
  for (const domain of domains) {
    for (const dimension of domain.dimensions) {
      parts.push(dimension.zh, dimension.en)
      parts.push(...pickSlots(dimension.slots, 'zh'))
      parts.push(...pickSlots(dimension.slots, 'en'))
      const probe = DIMENSION_PROBES[`${domain.id}.${dimension.id}`]
      if (probe !== undefined) {
        for (const sources of Object.values(probe.slots ?? {})) parts.push(...sources)
      }
    }
    parts.push(blueprintFor(domain.id, 'zh') ?? '', blueprintFor(domain.id, 'en') ?? '')
  }
  return parts.join(' ').toLowerCase()
}

for (const item of CASES) {
  test(`covers the work breakdown a strong answer uses: ${item.raw.slice(0, 14)}`, () => {
    const domains = detectDomains(item.raw)
    assert.equal(domains[0]?.id, item.domain)
    const knowledge = knowledgeOf(domains)
    const missing = item.mustCover.filter(term => !knowledge.includes(term.toLowerCase()))
    assert.deepEqual(missing, [], `missing coverage: ${missing.join(', ')}`)
  })
}

test('the system prompt carries the domain skeleton, not only the gap list', () => {
  const domains = detectDomains('用 STM32 读取热电偶温度')
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains,
  })
  assert.match(system, /work breakdown/u)
  assert.match(system, /误差预算/u)
  // 骨架不是决策：不能变成替用户选型号。
  assert.match(system, /it is a skeleton, not a decision/u)
})

test('a draft with no domain still gets a generic skeleton', () => {
  const system = buildSystemPrompt({
    mode: 'standard',
    framework: undefined,
    locale: 'zh',
    maxResultChars: 4000,
    domains: [],
  })
  assert.match(system, /目标 → 输入与前提 → 步骤/u)
})
