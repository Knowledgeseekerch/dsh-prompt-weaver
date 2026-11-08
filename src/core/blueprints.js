// 领域工程骨架：这类任务「答全了长什么样」。
//
// 与 dimensions 的分工：
// - dimensions 回答「用户说了没」，用于判定缺口；
// - blueprint 回答「执行方该怎么组织答案」，用于给骨架。
//
// 差别在于是把问题抛回用户，还是替用户把结构先立起来。
// 草稿信息不足时，人拿到一份「你还缺 8 项」动不了手；
// 拿到「按这个骨架填，其中这三项请你定」才能开工。
// 骨架只定顺序与覆盖面，不替用户做任何选型或数值决定。
export const DOMAIN_BLUEPRINTS = Object.freeze({
  hardware: Object.freeze({
    zh: '选型与依据 → 接线与引脚 → 供电与电平 → 初始化顺序 → 采样或控制回路及其周期 → 原始值到物理量的换算（标定、补偿）→ 滤波与限幅 → 验收测量 → 误差预算',
    en: 'chosen parts and why → wiring and pins → power and levels → initialisation order → sampling or control loop and its period → raw reading to physical value (calibration, compensation) → filter and limits → acceptance measurement → error budget',
  }),
  software: Object.freeze({
    zh: '目录与模块 → 入口与路由 → 模板与视图 → 数据结构 → 核心流程 → 输入校验与错误处理 → 凭证与会话 → 运行与验证命令',
    en: 'layout and modules → entry and routes → templates and views → data structures → core flow → input validation and error handling → credentials and sessions → how to run and verify',
  }),
  mechanical: Object.freeze({
    zh: '功能与工况 → 材料与热处理 → 结构与尺寸链 → 公差与配合 → 工艺路线 → 装配与紧固 → 校核与验收',
    en: 'function and duty → material and heat treatment → structure and dimension chain → tolerances and fits → process route → assembly and fastening → analysis and acceptance',
  }),
  diagnosis: Object.freeze({
    zh: '现象与标准名称 → 已排除项与依据 → 证据位置 → 按可能性排序的原因 → 最小代价的验证步骤 → 修复与回归验证',
    en: 'symptom and standard name → what is ruled out and on what evidence → where the evidence lives → causes ranked by likelihood → cheapest verification first → fix and regression check',
  }),
  data: Object.freeze({
    zh: '输入与编码 → 字段与类型 → 对齐与合并规则 → 清洗与去重 → 输出与对账',
    en: 'inputs and encoding → fields and types → join and merge rules → cleaning and dedupe → output and reconciliation',
  }),
  research: Object.freeze({
    zh: '问题与范围 → 来源与检索式 → 证据分级 → 对比与打分 → 冲突与取舍 → 结论与适用边界',
    en: 'question and scope → sources and search terms → evidence grading → comparison and scoring → conflicts and resolution → conclusion and limits',
  }),
  writing: Object.freeze({
    zh: '读者与目的 → 结构与小标题 → 必写与禁写 → 篇幅 → 交付形态',
    en: 'reader and purpose → structure and headings → must include and must avoid → length → delivery form',
  }),
  operations: Object.freeze({
    zh: '起点状态 → 逐步动作与到位确认 → 成功现象 → 失败回退 → 必须停下来问人的条件',
    en: 'starting state → step-by-step actions with landing checks → success sign → fallback on failure → when to stop and ask',
  }),
  plan: Object.freeze({
    zh: '目标与边界 → 阶段与阶段产出 → 前置条件 → 验收判据 → 风险与排除',
    en: 'goal and boundary → phases and deliverables → prerequisites → acceptance → risks and pre-emption',
  }),
  document: Object.freeze({
    zh: '类型与受众 → 大纲与每页要点 → 模板与字号 → 内容与数据来源 → 图表与标注 → 交付格式与讲稿',
    en: 'type and audience → outline and point per slide → template and type scale → content and data sources → charts and labels → delivery format and speaker notes',
  }),
})

/** 没命中任何领域时用的通用骨架：任何任务都能按它组织。 */
export const GENERIC_BLUEPRINT = Object.freeze({
  zh: '目标 → 输入与前提 → 步骤 → 可观测的成功判据 → 失败时怎么办',
  en: 'goal → inputs and prerequisites → steps → observable success condition → what to do when it fails',
})

/** 取骨架文本；没有登记返回 undefined（由调用方回落到通用骨架）。 */
export function blueprintFor(domainId, locale = 'en') {
  const entry = DOMAIN_BLUEPRINTS[domainId]
  if (entry === undefined) return undefined
  return locale === 'zh' ? entry.zh : entry.en
}
