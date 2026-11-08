import { freezeDeep } from './utils.js'

// 每个领域列的是「这类任务要能执行，执行方必须回答、但用户常省略」的维度。
//
// 分寸：这里只写「该回答什么」，不写「答案是什么」。
// 要求「说明主控型号与选择理由」是锐化；替用户定成「用 STM32F103」是编造，
// 后者把猜测钉死在提示词里，用户还得反过来纠正。
//
// slots 是这一维必须点到的子项。抽象维度（「说明关键部件」）执行方仍会答得笼统，
// 点名槽位（「主控 / 电机与驱动 / 传感器 / 电源」）才逼出具体内容。
const DOMAINS = Object.freeze([
  {
    id: 'hardware',
    keywords: [
      '小车', '机器人', '电路', '单片机', '电机', '舵机', '传感器', '硬件', '电路板', '电源', '电池',
      '驱动', '焊接', '面包板', '树莓派', '机械', '结构件', '轴承', '齿轮', '3d打印', '雷达', '摄像头',
      'arduino', 'stm32', 'esp32', 'raspberry', 'pcb', 'servo', 'motor', 'sensor', 'robot', 'circuit',
      'hardware', 'microcontroller',
    ],
    dimensions: [
      {
        id: 'parts',
        zh: '关键部件清单，每个部件在这套东西里负责什么',
        en: 'the key parts and what each one is responsible for',
        slots: { zh: ['主控', '电机与驱动', '传感器', '电源'], en: ['controller', 'motors and driver', 'sensors', 'power'] },
      },
      {
        id: 'selection',
        zh: '部件选型：型号、选它的理由、被淘汰的替代方案',
        en: 'the part chosen, why it won, and the alternative it beat',
        slots: { zh: ['型号', '理由', '替代方案'], en: ['model', 'reason', 'rejected alternative'] },
      },
      {
        id: 'functions',
        zh: '要实现的核心功能，每条写清触发条件与对应动作',
        en: 'the core behaviours, each with its trigger and its response',
        slots: { zh: ['功能清单', '触发条件'], en: ['behaviour list', 'trigger condition'] },
      },
      {
        id: 'control-layer',
        zh: '控制逻辑与软件分层：主循环怎么转、状态怎么切、上下位怎么通信',
        en: 'control logic and the software split: the main loop, the state transitions, how the layers talk',
        slots: { zh: ['主循环', '状态切换', '通信协议'], en: ['main loop', 'state transitions', 'protocol'] },
      },
      {
        id: 'power-interface',
        zh: '供电与接线：电压、电流预算、每个接口的定义',
        en: 'power and wiring: voltage, current budget, and the definition of each interface',
        slots: { zh: ['电压', '电流预算', '针脚定义'], en: ['voltage', 'current budget', 'pin assignment'] },
      },
      {
        id: 'assembly-order',
        zh: '装配与首次上电的顺序，每步之前该确认什么',
        en: 'the assembly and first-power-on order, and what to confirm before each step',
        slots: { zh: ['装配顺序', '上电前检查'], en: ['assembly order', 'pre-power checks'] },
      },
      {
        id: 'measure',
        zh: '每个阶段的实测判据：用什么工具测、测到什么数值算通过',
        en: 'a measured pass condition per stage: which tool, which number counts as passing',
        slots: { zh: ['工具', '通过数值'], en: ['instrument', 'passing number'] },
      },
      {
        id: 'failure-modes',
        zh: '这类装置最常见的失败现象，以及按什么顺序排查',
        en: 'the most common failure symptoms for this kind of build and the order to check them in',
        slots: { zh: ['典型现象', '排查顺序'], en: ['typical symptom', 'check order'] },
      },
    ],
  },
  {
    id: 'software',
    keywords: [
      '程序', '代码', '函数', '接口', '系统', '应用', '服务', '脚本', '数据库', '模块', '重构', '编译',
      '批量', '脚本处理',
      'api', 'sdk', 'web', 'app', 'backend', 'frontend', 'library', 'cli', 'server', 'database', 'code',
    ],
    dimensions: [
      {
        id: 'modules',
        zh: '模块划分与各自职责边界',
        en: 'the modules and the boundary of each responsibility',
        slots: { zh: ['模块清单', '职责边界'], en: ['module list', 'responsibility boundary'] },
      },
      {
        id: 'contract',
        zh: '对外接口与数据格式：字段名、类型、示例输入输出',
        en: 'the external interface and data shape: field names, types, sample input and output',
        slots: { zh: ['输入', '输出', '字段与类型'], en: ['input', 'output', 'fields and types'] },
      },
      {
        id: 'environment',
        zh: '依赖与运行环境，含版本约束',
        en: 'dependencies and runtime, including version constraints',
        slots: { zh: ['依赖', '运行环境'], en: ['dependencies', 'runtime'] },
      },
      {
        id: 'edge-cases',
        zh: '错误处理与边界条件：什么情况算失败、失败时返回什么',
        en: 'error handling and edge cases: what counts as failure and what comes back then',
        slots: { zh: ['失败条件', '失败处理', '副作用保护'], en: ['failure conditions', 'failure handling', 'side-effect safety'] },
      },
      {
        id: 'verify',
        zh: '可自动执行的验收方式：命令、断言、期望输出',
        en: 'an automatically runnable acceptance check: command, assertion, expected output',
        slots: { zh: ['命令', '期望输出'], en: ['command', 'expected output'] },
      },
    ],
  },
  {
    id: 'research',
    keywords: [
      '调研', '研究', '对比', '比较', '综述', '论文', '文献', '竞品', '选型调研', '方案对比',
      'research', 'survey', 'compare', 'comparison', 'benchmark', 'literature',
    ],
    dimensions: [
      {
        id: 'scope',
        zh: '检索范围与时间窗：查哪些来源、只算哪个时间段',
        en: 'search scope and time window: which sources, which period counts',
        slots: { zh: ['来源', '时间窗'], en: ['sources', 'time window'] },
      },
      {
        id: 'criteria',
        zh: '对比维度，以及每项怎么打分或排序',
        en: 'the comparison criteria and how each one is scored or ranked',
        slots: { zh: ['对比项', '打分方式'], en: ['criteria', 'scoring'] },
      },
      {
        id: 'sources',
        zh: '来源分层与可信度判断依据',
        en: 'how sources are tiered and what makes one more credible',
        slots: { zh: ['来源分级', '可信度依据'], en: ['source tiers', 'credibility basis'] },
      },
      {
        id: 'conflict',
        zh: '证据互相矛盾时的处理规则',
        en: 'the rule for handling conflicting evidence',
        slots: { zh: ['冲突判定', '取舍规则'], en: ['conflict detection', 'resolution rule'] },
      },
      {
        id: 'limits',
        zh: '结论的适用边界：这些条件不成立时结论会失效',
        en: 'the limits of the conclusion: when these conditions fail, it stops holding',
        slots: { zh: ['适用条件', '失效边界'], en: ['applies when', 'stops holding when'] },
      },
    ],
  },
  {
    id: 'writing',
    keywords: [
      '文章', '文案', '邮件', '报告', '总结', '演讲稿', '简章', '通告', '推文', '说明文', '汇报',
      'essay', 'article', 'email', 'report', 'copywriting', 'newsletter',
    ],
    dimensions: [
      {
        id: 'audience',
        zh: '读者是谁，读完要做什么',
        en: 'who reads it and what they should do after reading',
        slots: { zh: ['读者', '读后动作'], en: ['reader', 'desired action'] },
      },
      {
        id: 'length',
        zh: '篇幅与结构',
        en: 'the length and the structure',
        slots: { zh: ['篇幅', '结构'], en: ['length', 'structure'] },
      },
      {
        id: 'include',
        zh: '必须出现的内容与必须回避的表述',
        en: 'what must appear and what must be avoided',
        slots: { zh: ['必写', '禁写'], en: ['must include', 'must avoid'] },
      },
      {
        id: 'format',
        zh: '交付形态：纯文本、带小标题、可直接发送',
        en: 'the delivery form: plain text, headed, or ready to send',
        slots: { zh: ['交付格式'], en: ['delivery format'] },
      },
    ],
  },
  {
    id: 'operations',
    keywords: [
      '打开', '点击', '点赞', '关注', '发送', '转发', '下载', '上传', '登录', '扫码', '导出', '导入',
      '自动完成', '帮我操作',
      'open', 'click', 'tap', 'like', 'follow', 'download', 'upload', 'login', 'export', 'import',
    ],
    dimensions: [
      {
        id: 'start',
        zh: '起点状态：开始前界面或数据应该是什么样',
        en: 'the starting state: what the screen or data looks like before it begins',
        slots: { zh: ['起始界面', '前提数据'], en: ['starting screen', 'required data'] },
      },
      {
        id: 'steps',
        zh: '逐步动作，每步之后如何确认已经到位',
        en: 'the steps in order, and how to confirm each one landed',
        slots: { zh: ['动作序列', '到位确认'], en: ['action sequence', 'landing check'] },
      },
      {
        id: 'success',
        zh: '成功的可观测现象：哪个位置出现了什么',
        en: 'the observable sign of success: what appears, and where',
        slots: { zh: ['成功现象'], en: ['success sign'] },
      },
      {
        id: 'fallback',
        zh: '失败时的回退动作，以及哪些情况必须停下来问人',
        en: 'the fallback on failure and which cases must stop and ask a human',
        slots: { zh: ['回退动作', '必须停下来问人的条件'], en: ['fallback action', 'stop-and-ask cases'] },
      },
    ],
  },
  {
    id: 'plan',
    keywords: [
      '方案', '设计', '规划', '路线', '可行性', '实现方案', '计划', '推进', '里程碑', '怎么做', '如何实现', '法子',
      'plan', 'design', 'roadmap', 'approach', 'strategy', 'proposal', 'milestone', 'feasibility',
    ],
    dimensions: [
      {
        id: 'goal-boundary',
        zh: '目标与边界：明确不做什么，避免范围失控',
        en: 'the goal and the boundary: what is explicitly out of scope',
        slots: { zh: ['目标', '不做什么'], en: ['goal', 'out of scope'] },
      },
      {
        id: 'phases',
        zh: '阶段划分，以及每个阶段结束时的产出物',
        en: 'the phases and the artifact each one ends with',
        slots: { zh: ['阶段', '阶段产出'], en: ['phases', 'artifact per phase'] },
      },
      {
        id: 'prerequisites',
        zh: '前置条件：开始前必须先具备什么',
        en: 'prerequisites: what must exist before starting',
        slots: { zh: ['前置条件'], en: ['prerequisites'] },
      },
      {
        id: 'acceptance',
        zh: '每个阶段可观测的验收判据：看到什么现象、测到什么数值算过',
        en: 'an observable acceptance condition per phase: which symptom or number counts as passing',
        slots: { zh: ['现象', '数值'], en: ['symptom', 'number'] },
      },
      {
        id: 'risks',
        zh: '主要风险与提前排除的方法',
        en: 'the main risks and how to rule each one out early',
        slots: { zh: ['风险', '排除方法'], en: ['risk', 'pre-emptive check'] },
      },
    ],
  },
])

const MAX_DOMAINS = 2

export function detectDomains(text, limit = MAX_DOMAINS) {
  const normalized = String(text ?? '').toLowerCase()
  if (normalized.length === 0) return freezeDeep([])
  const scored = []
  for (const domain of DOMAINS) {
    let score = 0
    for (const keyword of domain.keywords) {
      if (!normalized.includes(keyword)) continue
      score += keyword.length > 3 ? 2 : 1
    }
    if (score > 0) scored.push({ id: domain.id, score })
  }
  const picked = scored
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, limit))
    .map(entry => DOMAINS.find(domain => domain.id === entry.id))
  return freezeDeep(picked.map(domain => ({
    id: domain.id,
    dimensions: domain.dimensions.map(dimension => ({
      id: dimension.id,
      zh: dimension.zh,
      en: dimension.en,
      slots: { zh: dimension.slots.zh, en: dimension.slots.en },
    })),
  })))
}

export function pickSlots(slots, locale) {
  if (slots === undefined || slots === null) return []
  return locale === 'zh' ? (slots.zh ?? []) : (slots.en ?? [])
}

/**
 * 把维度摊平成一句话，供系统提示词引用。
 * 维度后面用中括号带上必须点到的槽位——只给抽象维度，执行方照样答得笼统。
 */
export function describeDimensions(domains, locale) {
  const lines = []
  for (const domain of domains ?? []) {
    const items = domain.dimensions.map(dimension => {
      const text = locale === 'zh' ? dimension.zh : dimension.en
      const slots = pickSlots(dimension.slots, locale)
      return slots.length === 0 ? text : `${text} [${slots.join(' / ')}]`
    })
    lines.push(`${domain.id}: ${items.join('; ')}`)
  }
  return lines
}
