// 领域惯例：这类任务里「行业已有共识、但用户通常不会写」的工作纪律。
//
// 与 dimensions、blueprints、话题惯例的分工：
// - dimensions 判断用户说了没；
// - blueprints 给出答案的组织骨架；
// - TOPIC_CONVENTIONS 给具体技术决定（冷端补偿、抗积分饱和、密码哈希…）；
// - 这里的 DOMAIN_CONVENTIONS 只放该领域通用的工作纪律，不重复话题层的内容。
//
// 分寸：这些是默认可替换的行业做法，不是替用户选型。提示词里明确要求
// 「草稿已指定则遵从草稿，采用默认时标明可替换」。
export const DOMAIN_CONVENTIONS = Object.freeze({
  hardware: Object.freeze([
    Object.freeze({
      zh: '采样值要滤波并限幅：单次异常读数会直接进显示或控制量',
      en: 'filter and clamp the samples; one bad reading otherwise reaches the display or the control output directly',
    }),
    Object.freeze({
      zh: '代码注明所用库与版本、引脚映射、可调参数；不注明就不可复现',
      en: 'state the library and its version, the pin mapping, and the tunable parameters; without them the code cannot be reproduced',
    }),
    Object.freeze({
      zh: '写清供电与电平、首次上电前的检查项，不能默认「接上就能用」',
      en: 'state power and logic levels and the pre-power-on checks; never assume it just works when connected',
    }),
    Object.freeze({
      zh: '给验收测量：用什么仪器、测到什么数值算通过',
      en: 'give the acceptance measurement: which instrument, which number counts as passing',
    }),
  ]),
  software: Object.freeze([
    Object.freeze({
      zh: '输入校验放在服务端；前端校验只是体验，不是防线',
      en: 'validate on the server; client-side checks are convenience, not a boundary',
    }),
    Object.freeze({
      zh: '给出可运行的验证命令与期望输出，而不是「运行一下看看」',
      en: 'give a runnable verification command and its expected output instead of "run it and see"',
    }),
    Object.freeze({
      zh: '依赖与版本写清；运行环境不一致是最常见的失败原因',
      en: 'state dependencies and versions; a mismatched runtime is the most common failure',
    }),
    Object.freeze({
      zh: '失败路径要有明确返回：错误码、退出码或用户可见提示',
      en: 'every failure path returns something definite: an error code, an exit code, or a visible message',
    }),
  ]),
  data: Object.freeze([
    Object.freeze({
      zh: '保留原始文件，结果写到新文件；覆盖原文件要显式说明',
      en: 'keep the originals and write to a new file; overwriting has to be stated explicitly',
    }),
    Object.freeze({
      zh: '缺失值处理逐列写明（丢弃／补空／补零），不同列可以不同',
      en: 'state the missing-value rule per column (drop, blank, zero); it need not be uniform',
    }),
    Object.freeze({
      zh: '输出要可核对：行数、校验和或总数，至少能证明这次没丢数据',
      en: 'make the output verifiable: row count, checksum, or total — at minimum proof that nothing was lost',
    }),
    Object.freeze({
      zh: '处理前先看数据规模，规模决定实现方式（能不能整个读进内存）',
      en: 'check the data size first; it decides whether the whole file can be held in memory',
    }),
  ]),
  diagnosis: Object.freeze([
    Object.freeze({
      zh: '每一步写目的：这一步排除什么，看到什么结果才算排除',
      en: 'every step says what it rules out and which observation counts as ruled out',
    }),
    Object.freeze({
      zh: '顺序按「代价最低、信息量最大」排；直接建议重装是最差的排查',
      en: 'order by lowest cost and highest information; recommending a reinstall is the worst possible triage',
    }),
    Object.freeze({
      zh: '先取最小复现：能稳定复现再动手，否则改完也不知道是不是好了',
      en: 'get a minimal reproduction first; without one you cannot tell whether a change fixed anything',
    }),
    Object.freeze({
      zh: '修复后要有回归验证：同一现象不再出现，且原功能仍在',
      en: 'after the fix, verify regression: the symptom is gone and the original behaviour still works',
    }),
  ]),
  mechanical: Object.freeze([
    Object.freeze({
      zh: '关键尺寸必须有基准，并写明基准是面还是孔',
      en: 'every critical dimension needs a named datum (a face or a hole)',
    }),
    Object.freeze({
      zh: '工艺路线在设计阶段就确定：能不能加工，决定尺寸敢不敢这么标',
      en: 'fix the process route while designing: manufacturability decides which dimensions are legal',
    }),
    Object.freeze({
      zh: '给验收：用什么量具、测什么、合格判据是什么',
      en: 'give the acceptance: which instrument, which measurement, which pass criterion',
    }),
  ]),
  research: Object.freeze([
    Object.freeze({ zh: '先给检索式与来源清单，再谈结论', en: 'give the search terms and the source list before any conclusion' }),
    Object.freeze({ zh: '证据分级：一手/二手、同行评审/预印本/厂商材料', en: 'grade the evidence: primary or secondary, peer-reviewed or preprint or vendor material' }),
    Object.freeze({ zh: '结论要写适用边界，说明在什么条件下不成立', en: 'state where the conclusion stops holding' }),
  ]),
  writing: Object.freeze([
    Object.freeze({ zh: '先定读者与读后动作，再定写法', en: 'fix the reader and the action they should take before deciding how to write' }),
    Object.freeze({ zh: '给结构与篇幅，不写「写得好一点」这种要求', en: 'specify structure and length instead of asking for "better writing"' }),
    Object.freeze({ zh: '必写项与禁写项分开列，禁写项按语义判而不是列关键词', en: 'separate must-include from must-avoid, and judge the avoided family by meaning rather than by keyword' }),
  ]),
  operations: Object.freeze([
    Object.freeze({ zh: '写清起点界面与前提数据，否则第一步就卡住', en: 'state the starting screen and required data, or the first step stalls' }),
    Object.freeze({ zh: '每一步给到位确认：看到什么才算这一步成功', en: 'each step carries a landing check: what must appear for it to count as done' }),
    Object.freeze({ zh: '给出失败回退，以及必须停下来问人的情况', en: 'give the fallback and the cases that must stop and ask a human' }),
  ]),
  plan: Object.freeze([
    Object.freeze({ zh: '先写不做什么，范围不设边界就一定会失控', en: 'write down what is out of scope; unbounded scope always overruns' }),
    Object.freeze({ zh: '每个阶段要有产出物，没有产出的阶段不是阶段', en: 'every phase ends with an artifact; a phase with no artifact is not a phase' }),
    Object.freeze({ zh: '验收判据要可观测：看到什么现象、测到什么数', en: 'acceptance must be observable: which sign, which number' }),
  ]),
  document: Object.freeze([
    Object.freeze({
      zh: '先定模板、字号与页边距，再填内容；反过来做等于返工',
      en: 'fix template, type scale, and margins before writing; the other order is rework',
    }),
    Object.freeze({
      zh: '一页一个观点，标题写结论而不是话题（「成本下降 12%」而不是「成本分析」）',
      en: 'one point per page, and the title states the conclusion, not the topic ("cost down 12%", not "cost analysis")',
    }),
    Object.freeze({
      zh: '数据图必须标单位与来源；没有来源的数字不要放进汇报材料',
      en: 'every chart labels its unit and source; a number without a source does not belong in a report',
    }),
    Object.freeze({
      zh: '演示页不要塞满正文：要讲的内容进备注页，页面上只留结论与图',
      en: 'do not fill slides with body text: prose goes into the speaker notes, the slide keeps the conclusion and the chart',
    }),
  ]),
})

/** 取该领域的惯例清单；没有登记返回空数组。 */
export function conventionsFor(domainId, locale = 'en') {
  const entries = DOMAIN_CONVENTIONS[domainId]
  if (!Array.isArray(entries)) return []
  return entries.map(entry => (locale === 'zh' ? entry.zh : entry.en))
}

// 话题级惯例：由草稿里的具体线索触发，比「整领域」更准。
//
// 「用 STM32 读热电偶」和「用 STM32 做智能小车」同属 hardware，
// 但前者必须知道冷端补偿，后者不需要。只按领域给建议，要么漏，要么灌水。
// 这里按关键词命中注入，命中不了就不注入——宁可少给，不硬凑。
export const TOPIC_CONVENTIONS = Object.freeze([
  Object.freeze({
    id: 'thermocouple',
    match: Object.freeze(['热电偶', '热电阻', 'pt100', 'pt1000', 'thermocouple', 'k型', 'k type', 'ntc', 'ds18b20', 'max31855', '冷端']),
    zh: Object.freeze([
      '热电偶必须做冷端补偿（板载温度传感器或 MAX31855 这类专用芯片），否则读数会跟着室温漂移',
      '先由位深与参考电压算出 LSB，再折算温度；窄温区可线性近似，全量程要查表或分段线性',
    ]),
    en: Object.freeze([
      'cold-junction compensation is mandatory (on-board sensor or a dedicated chip); without it the reading tracks room temperature',
      'derive the LSB from bit depth and reference, then convert; linear approximation only over a narrow range, lookup table or piecewise otherwise',
    ]),
  }),
  Object.freeze({
    id: 'closed-loop',
    match: Object.freeze(['pid', '闭环', '控温', '温控', '调参', '超调', '积分饱和', 'control loop']),
    zh: Object.freeze([
      'PID 要写明采样周期，并与积分增益匹配；周期抖动会让积分项失真',
      '积分饱和必须处理（输出限幅 + 抗饱和回退），否则升温阶段积分会一路累积',
      '给出整定方法与初值（如齐格勒-尼科尔斯或经验值），不要只写「调一下 Kp/Ki/Kd」',
    ]),
    en: Object.freeze([
      'state the sampling period and match it to the integral gain; jitter in the period corrupts the integral term',
      'handle integral windup (output clamp plus anti-windup), or the integral accumulates during heat-up',
      'give a tuning method and initial values (Ziegler-Nichols or a known starting point), not "tune Kp/Ki/Kd"',
    ]),
  }),
  Object.freeze({
    id: 'power-drive',
    match: Object.freeze(['pwm', '加热', '加热管', '继电器', '固态继电器', 'ssr', 'mos', 'h桥', '电机驱动', '执行机构']),
    zh: Object.freeze([
      'PWM 只决定占空比：功率器件（MOS／固态继电器）与过流、过热、开路保护要单独写',
      '加热类负载要说明冷启动电流与保险选型，不能只按额定功率算',
    ]),
    en: Object.freeze([
      'a duty cycle is not a driver: name the power device and the over-current, over-temperature, and open-circuit protection',
      'for a heater, account for the cold-start current and fuse selection; rated power alone is not enough',
    ]),
  }),
  Object.freeze({
    id: 'auth',
    match: Object.freeze(['登录', '密码', 'login', 'password', 'session', '会话', '鉴权', '认证', '注册']),
    zh: Object.freeze([
      '密码只存哈希；优先用框架自带的实现（Flask 的 werkzeug.security），确需更强算法再加 bcrypt／argon2，并写进依赖清单',
      '登录失败统一提示，不区分「用户不存在」与「密码错误」，避免账号枚举',
      '会话密钥从环境变量读；输入校验必须放在服务端',
    ]),
    en: Object.freeze([
      'store only a password hash (bcrypt or argon2); never plaintext, never reversible encryption',
      'one message for every failed login: distinguishing "no such user" leaks account existence',
      'read the session secret from the environment, and validate input on the server',
    ]),
  }),
  Object.freeze({
    id: 'tabular-merge',
    match: Object.freeze(['csv', '表格', 'excel', 'xlsx', '合并', '拼接', '去重', '重复行', '对齐', '数据集']),
    zh: Object.freeze([
      '合并前核对列结构与编码，不一致先对齐；不要按列位置静默拼接',
      '去重口径写死：整行完全相同还是按主键；同键多条时保留哪一条',
      '写完对账：输入行数之和 = 输出行数 + 删除行数',
    ]),
    en: Object.freeze([
      'check column structure and encoding before merging; never concatenate by position silently',
      'fix the duplicate rule (full row or key) and which record survives',
      'reconcile: inputs total = output rows + removed rows',
    ]),
  }),
  Object.freeze({
    id: 'crash-triage',
    match: Object.freeze(['蓝屏', 'bsod', '停止码', '崩溃', '闪退', '卡死', '死机', '无响应', 'bluescreen', 'crash']),
    zh: Object.freeze([
      '先拿停止码或错误码；没有它，后面的判断都是概率',
      '用安全模式或干净启动做二分，先分清系统本体与第三方软件',
      '内存与磁盘健康单独跑（memtest、SMART），不要和软件层排查混在一起',
    ]),
    en: Object.freeze([
      'get the stop or error code first; without it every later step is a probability',
      'bisect with safe mode or a clean boot to separate the OS from third-party software',
      'run memory and disk health checks separately (memtest, SMART)',
    ]),
  }),
  Object.freeze({
    id: 'mechanical-design',
    match: Object.freeze(['支架', '法兰', '图纸', '工程图', '公差', '配合', '材料', '热处理', '钣金', '零件图', '装配图']),
    zh: Object.freeze([
      '先定材料与热处理再谈尺寸；公差按配合性质给，不按「经验」给一个数',
      '关键尺寸必须有基准，并写明基准是面还是孔',
      '工艺路线在设计阶段就确定：能不能加工，决定尺寸敢不敢这么标',
    ]),
    en: Object.freeze([
      'settle material and heat treatment before dimensions; derive tolerances from the fit type, not from a guessed number',
      'every critical dimension needs a named datum (a face or a hole)',
      'fix the process route while designing: manufacturability decides which dimensions are legal',
    ]),
  }),
  Object.freeze({
    id: 'slides',
    match: Object.freeze(['ppt', '幻灯片', '演示文稿', '汇报', '答辩', '路演', '宣讲', '课件', 'slide', 'deck']),
    zh: Object.freeze([
      '先定页数与每页一句话结论，再找素材；先堆素材一定会超页',
      '引用别人的图要写出处，图上直接标来源，不要只在末尾列一条',
    ]),
    en: Object.freeze([
      'fix the page count and the one-line conclusion per page before collecting material; material first always overruns',
      'a borrowed chart cites its origin on the chart itself, not only in a closing list',
    ]),
  }),
  Object.freeze({
    id: 'resume',
    match: Object.freeze(['简历', 'resume', 'cv', '求职']),
    zh: Object.freeze([
      '一页之内，倒序排列，最近的经历放最前',
      '每条经历写清「做了什么 + 量化结果」，不写职责描述',
      '按目标岗位的关键词改写措辞，让筛选和人都能对上',
    ]),
    en: Object.freeze([
      'one page, reverse chronological, most recent first',
      'each entry states what was done plus a quantified result, not a job description',
      'mirror the target role vocabulary so both the screen and the reader match it',
    ]),
  }),
  Object.freeze({
    id: 'paper-format',
    match: Object.freeze(['论文', '开题', '参考文献', '排版', '标书', '说明书']),
    zh: Object.freeze([
      '先确认格式规范（学校或单位的模板），标题层级、图表编号、参考文献格式都按它来',
      '图表要有编号与标题，正文里必须被引用到，不能只贴不引',
      '参考文献与正文一一对应：正文引了的都要列出，列出的都被引到',
    ]),
    en: Object.freeze([
      'confirm the required format first (the school or organisation template): heading levels, figure and table numbering, reference style',
      'every figure and table needs a number and a caption, and must be referenced in the body',
      'references and citations must correspond one to one in both directions',
    ]),
  }),
])

/**
 * 按草稿线索取惯例：先按话题命中，再用领域惯例补足，总数有上限。
 * 命中不了话题就只给领域惯例，不会硬凑。
 */
export function conventionsForDraft(text, { domainId, locale = 'en', limit = 8 } = {}) {
  const haystack = String(text ?? '').toLowerCase()
  const picked = []
  const seen = new Set()
  const push = (line) => {
    if (typeof line !== 'string' || line.length === 0) return
    if (seen.has(line)) return
    seen.add(line)
    picked.push(line)
  }
  for (const entry of TOPIC_CONVENTIONS) {
    if (!entry.match.some(keyword => haystack.includes(String(keyword).toLowerCase()))) continue
    for (const line of (locale === 'zh' ? entry.zh : entry.en)) push(line)
  }
  for (const line of conventionsFor(domainId, locale)) push(line)
  return picked.slice(0, limit)
}
