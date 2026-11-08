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
      '驱动', '面包板', '树莓派', '3d打印', '雷达', '摄像头',
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
        slots: { zh: ['主循环', '状态切换', '通信协议', '控制律'], en: ['main loop', 'state transitions', 'protocol', 'control law'] },
      },
      {
        // 「用 PWM 驱动加热」这类话一旦没写进必答项，答案就停在「调一下占空比」，
        // 而真正决定能不能用的功率器件、驱动方式和保护全都缺席。
        id: 'actuation',
        zh: '执行机构与驱动：驱动方式、功率器件、占空比或频率、过流过热保护',
        en: 'the actuator and its driver: drive method, power device, duty cycle or frequency, over-current and over-temperature protection',
        slots: { zh: ['驱动方式', '功率器件', '占空比或频率', '保护'], en: ['drive method', 'power device', 'duty or frequency', 'protection'] },
      },
      {
        id: 'power-interface',
        zh: '供电与接线：电压、电流预算、每个接口的定义',
        en: 'power and wiring: voltage, current budget, and the definition of each interface',
        slots: { zh: ['电压', '电流预算', '针脚定义'], en: ['voltage', 'current budget', 'pin assignment'] },
      },
      {
        id: 'assembly-order',
        zh: '初始化与首次上电的顺序（外设初始化、装配先后），每步之前该确认什么',
        en: 'the initialisation and first-power-on order (peripheral init, assembly sequence), and what to confirm before each step',
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
      {
        // 采集链路是传感器类任务真正会翻车的地方：不带这层，答案会停在「用 ADC 读一下」，
        // 而冷端补偿、线性化、量程换算恰恰是决定读数对不对的全部内容。
        id: 'sensing',
        zh: '采集链路：信号调理、采样与分辨率、标定与线性化、补偿方式、滤波',
        en: 'the acquisition chain: signal conditioning, sampling and resolution, calibration and linearisation, compensation, filtering',
        slots: {
          zh: ['信号调理', '采样与分辨率', '标定与线性化', '补偿', '滤波'],
          en: ['signal conditioning', 'sampling and resolution', 'calibration and linearisation', 'compensation', 'filtering'],
        },
      },
      {
        id: 'error-budget',
        zh: '误差预算：主要误差来源各自贡献多少、用什么措施压缩',
        en: 'the error budget: what each error source contributes and how it is reduced',
        slots: { zh: ['误差来源', '改善措施'], en: ['error sources', 'mitigation'] },
      },
    ],
  },
  {
    id: 'software',
    keywords: [
      '程序', '代码', '函数', '接口', '系统', '应用', '服务', '脚本', '数据库', '模块', '重构', '编译',
      '批量', '脚本处理', '爬虫', '前端', '后端', '网页', '网站', '小程序', '登录页', '单元测试', '算法',
      '调试', '报错信息', '虚拟环境', '依赖包',
      'python', 'flask', 'django', 'fastapi', 'pandas', 'numpy', 'node', 'npm', 'react', 'vue',
      'javascript', 'typescript', 'java', 'golang', 'rust', 'api', 'sdk', 'web', 'app',
      'backend', 'frontend', 'library', 'cli', 'server', 'database', 'code',
    ],
    dimensions: [
      {
        id: 'modules',
        zh: '模块划分与各自职责边界',
        en: 'the modules and the boundary of each responsibility',
        slots: { zh: ['模块清单', '职责边界', '入口与路由'], en: ['module list', 'responsibility boundary', 'entry and routes'] },
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
      {
        // 登录页、表单、接口这类任务，校验与会话不是「加分项」而是能不能上线。
        id: 'security',
        zh: '安全与校验：输入如何校验、凭证与会话如何管理、权限边界在哪',
        en: 'safety and validation: how input is validated, how credentials and sessions are handled, where the permission boundary sits',
        slots: { zh: ['输入校验', '凭证与会话', '权限边界'], en: ['input validation', 'credentials and sessions', 'permission boundary'] },
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
      '摘要', '润色', '改写', '措辞', '文风', '学术', '润饰', '答辩稿', '论文摘要', '改写一下',
      'essay', 'article', 'email', 'report', 'copywriting', 'newsletter', 'abstract', 'rewrite', 'polish',
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
  {
    // 机械设计制造：这是「图纸 → 模型」那类任务真正的执行前提。
    // 与 hardware（电子/嵌入式）分开，两者的必答项几乎不重叠：
    // 电子问控制层与供电，机械问材料、公差、加工与基准。
    id: 'mechanical',
    keywords: [
      '支架', '法兰', '法兰盘', '轴', '传动轴', '齿轮', '箱体', '壳体', '机架', '底座', '导轨',
      '连杆', '钣金', '板件', '焊接件', '铸件', '锻件', '零件', '零件图', '装配图', '装配体',
      '工程图', '图纸', '三维模型', '建模', '草图', '倒角', '圆角', '键槽', '轴承座', '退刀槽',
      '减速器', '减速箱', '齿轮箱', '蜗轮', '蜗杆', '联轴器', '丝杠', '皮带轮', '链条', '轴承',
      '密封圈', '垫片', '销轴', '螺栓', '螺母', '板厚', '壁厚', '孔径', '孔距',
      '公差', '配合', '形位公差', '粗糙度', '热处理', '淬火', '调质', '退火', '正火', '表面处理',
      '镀锌', '阳极氧化', '发黑',
      '加工', '机加工', '铣削', '车削', '钻削', '磨削', '线切割', '冲压', '注塑', '焊接',
      '机械', '结构件',
      'solidworks', 'creo', 'catia', 'autocad', 'machining', 'tolerance',
      'sheet metal', 'weldment', 'bracket', 'flange', 'shaft', 'gearbox', 'mechanical',
    ],
    dimensions: [
      {
        id: 'material',
        zh: '材料与热处理：牌号、热处理、表面处理',
        en: 'material and heat treatment: grade, heat treatment, surface finish',
        slots: { zh: ['材料牌号', '热处理', '表面处理'], en: ['grade', 'heat treatment', 'surface finish'] },
      },
      {
        id: 'geometry',
        zh: '关键几何：总体尺寸、特征尺寸、基准',
        en: 'key geometry: overall size, feature size, datum',
        slots: { zh: ['总体尺寸', '特征尺寸', '基准'], en: ['overall size', 'feature size', 'datum'] },
      },
      {
        id: 'tolerance',
        zh: '公差与配合：尺寸公差、形位公差、配合制',
        en: 'tolerance and fit: dimensional tolerance, geometric tolerance, fit system',
        slots: { zh: ['尺寸公差', '形位公差', '配合制'], en: ['dimensional tolerance', 'geometric tolerance', 'fit system'] },
      },
      {
        id: 'process',
        zh: '加工工艺：工艺路线、加工设备、可加工性',
        en: 'manufacturing process: route, machine, manufacturability',
        slots: { zh: ['工艺路线', '加工设备', '可加工性'], en: ['process route', 'machine', 'manufacturability'] },
      },
      {
        id: 'assembly',
        zh: '装配约束：配合面、定位方式、紧固方式',
        en: 'assembly constraints: mating face, locating method, fastening',
        slots: { zh: ['配合面', '定位方式', '紧固'], en: ['mating face', 'locating method', 'fastening'] },
      },
      {
        id: 'load',
        zh: '载荷与工况：受力、安全系数、工作环境',
        en: 'loads and working conditions: forces, safety factor, environment',
        slots: { zh: ['受力', '安全系数', '工作环境'], en: ['loads', 'safety factor', 'environment'] },
      },
      {
        id: 'inspection',
        zh: '检验判据：量具、合格判据',
        en: 'inspection: instrument, acceptance criterion',
        slots: { zh: ['量具', '合格判据'], en: ['instrument', 'acceptance criterion'] },
      },
      {
        id: 'failure',
        zh: '失效模式：典型失效、排查顺序',
        en: 'failure modes: typical failure, check order',
        slots: { zh: ['典型失效', '排查顺序'], en: ['typical failure', 'check order'] },
      },
    ],
  },
  {
    // 诊断类任务单独成域：它的必答项不是「要做什么」，而是「现象叫什么、证据在哪」。
    // 缺了这层，0.3.3 写进系统提示词的诊断三步就落不到判定层——规则要求先命名现象，
    // 判定层却认不出这是诊断任务，于是检查空转、什么都报不出来。
    id: 'diagnosis',
    keywords: [
      '蓝屏', '黑屏', '报错', '错误信息', '异常退出', '崩溃', '闪退', '死机', '卡死', '卡顿',
      '无响应', '未响应', '开不了机', '启动不了', '起不来', '排查', '诊断', '故障', '不工作',
      '很慢', '很卡', '占满', '重启', '停止代码', '事件查看器',
      'bluescreen', 'bugcheck', 'crash', 'exception', 'traceback', 'error', 'fails', 'freeze',
      'hang', 'slow', 'unresponsive', 'troubleshoot', 'debug', 'dump',
    ],
    dimensions: [
      {
        id: 'symptom',
        zh: '现象本身：什么情况下出现、多频繁、原话是什么',
        en: 'the symptom itself: when it appears, how often, and the exact wording',
        slots: { zh: ['现象原话', '发生时机', '频率'], en: ['verbatim symptom', 'when it happens', 'frequency'] },
      },
      {
        id: 'naming',
        zh: '现象对应的标准名称或错误标识，名字决定去哪查',
        en: 'the standard name or error identifier of the symptom; the name decides where to look',
        slots: { zh: ['标准名称', '错误码'], en: ['standard name', 'error code'] },
      },
      {
        id: 'exclusion',
        zh: '已经排除了什么，以及凭什么排除',
        en: 'what has already been ruled out, and on what evidence',
        slots: { zh: ['已排除项', '排除依据'], en: ['ruled out', 'evidence for it'] },
      },
      {
        id: 'evidence',
        zh: '证据在哪里取：日志路径、事件 ID、dump 或截图位置',
        en: 'where the evidence lives: log path, event id, dump or screenshot location',
        slots: { zh: ['证据位置', '关键字段'], en: ['evidence location', 'field to read'] },
      },
      {
        id: 'environment',
        zh: '出问题时的环境快照与最近的变更',
        en: 'the environment snapshot at failure time and what changed recently',
        slots: { zh: ['系统与版本', '硬件配置', '最近变更'], en: ['os and version', 'hardware', 'recent change'] },
      },
      {
        id: 'reproduce',
        zh: '能否稳定复现，以及怎么复现',
        en: 'whether it reproduces reliably, and the steps that trigger it',
        slots: { zh: ['复现步骤', '复现概率'], en: ['reproduction steps', 'reproduction rate'] },
      },
      {
        // 「先软件后硬件」的渐进排查靠的就是这几招：缩小范围、对照、跑健康检测。
        // 不点名这三样，产出的排查清单只能停在「更新驱动、重装系统」。
        id: 'isolation',
        zh: '隔离验证：用安全模式或干净启动缩小范围、用对照环境验证、跑内存与磁盘健康检测',
        en: 'isolation: narrow the scope with safe mode or a clean boot, verify against a control environment, run memory and disk health checks',
        slots: { zh: ['最小复现环境', '对照验证', '健康检测'], en: ['minimal environment', 'control comparison', 'health checks'] },
      },
    ],
  },
  {
    // 数据处理类：合并、去重、对齐这类活干错的代价是数据错了却没人发现。
    // 必答项是「哪个字段是对齐依据」「冲突时留谁」，而不是「用什么工具」。
    id: 'data',
    keywords: [
      'csv', 'excel', 'xlsx', '表格', '数据表', '数据集', '数据清洗', '合并', '合成一张', '拼接',
      '去重', '字段', '列名', '行数', '透视', '汇总', '统计表', '筛选', '对齐', '缺失值', '清单',
      'json', 'jsonl', 'tsv', 'parquet', 'dataframe', 'pandas', 'sql', 'duplicate', 'merge', 'join', 'clean',
    ],
    dimensions: [
      {
        id: 'inputs',
        zh: '输入源：几个文件、什么格式与编码、多大规模',
        en: 'the inputs: how many files, what format and encoding, how large',
        slots: { zh: ['文件来源', '格式与编码', '数据规模'], en: ['file source', 'format and encoding', 'size'] },
      },
      {
        id: 'schema',
        zh: '字段与类型：每一列是什么、缺失值怎么处理、多个源文件的列结构是否一致',
        en: 'the fields and types: what each column holds, how missing values are handled, and whether the sources share one column structure',
        slots: { zh: ['字段名', '类型', '缺失值处理', '列结构一致性'], en: ['field names', 'types', 'missing-value rule', 'column alignment'] },
      },
      {
        id: 'keys',
        zh: '对齐依据：用哪个键匹配，匹配不上怎么办',
        en: 'the join key, and what happens when a record has no match',
        slots: { zh: ['连接键', '未匹配处理'], en: ['join key', 'unmatched handling'] },
      },
      {
        id: 'rules',
        zh: '清洗与去重规则：什么算重复、留哪一条、顺序如何',
        en: 'the cleaning and dedup rules: what counts as a duplicate, which one wins, what order',
        slots: { zh: ['去重判据', '保留规则'], en: ['duplicate rule', 'keep rule'] },
      },
      {
        id: 'output',
        zh: '输出目标与对账：落到哪、用什么数对得上（合并类任务的对账式是「输入行数之和 = 输出行数 + 删除数」）',
        en: 'the output target and its reconciliation: where it lands, and which numbers must add up (for a merge, inputs total = output rows + removed rows)',
        slots: { zh: ['输出格式', '校验方式', '行数对账'], en: ['output format', 'verification', 'row reconciliation'] },
      },
    ],
  },
  {
    // 日常交付物：PPT、Word 排版、Excel 表格。
    // 这类任务的成败不在「写得好不好」，而在模板、字号、页序、数据来源这些
    // 一开始没定、后面要返工一整晚的东西。
    id: 'document',
    keywords: [
      'ppt', '幻灯片', '演示文稿', '演示', '答辩', '汇报', '课件', '开题', '路演', '宣讲',
      'word', '文档', '报告', '说明书', '标书', '策划书', '简历', '排版', '页眉', '页脚',
      'excel', '工作表', '模板', '字号', '版式', '目录',
      'slide', 'deck', 'presentation', 'keynote', 'template', 'layout',
    ],
    dimensions: [
      {
        id: 'kind',
        zh: '交付物类型与场合：是文档、演示还是表格，给谁看、在什么场合用',
        en: 'the deliverable type and setting: document, deck, or sheet; who reads it and where it is used',
        slots: { zh: ['类型', '受众与场合', '使用方式'], en: ['type', 'audience and setting', 'how it is used'] },
      },
      {
        id: 'structure',
        zh: '结构与页序：各章节或各页分别承担什么，为什么是这个顺序',
        en: 'the structure and page order: what each section or slide carries, and why it comes in that order',
        slots: { zh: ['大纲', '每页或每节的要点', '顺序'], en: ['outline', 'point per slide or section', 'order'] },
      },
      {
        id: 'format',
        zh: '格式规范：模板、字号与行距、页边距、编号与页码',
        en: 'the formatting rules: template, type size and leading, margins, numbering and page numbers',
        slots: { zh: ['模板', '字号与行距', '编号与页码'], en: ['template', 'type size and leading', 'numbering and pagination'] },
      },
      {
        id: 'source',
        zh: '内容来源：数据从哪来、引用按什么规范、哪些是既有材料',
        en: 'the sources: where the numbers come from, which citation style applies, which material already exists',
        slots: { zh: ['数据来源', '引用规范', '既有素材'], en: ['data source', 'citation style', 'existing material'] },
      },
      {
        id: 'visual',
        zh: '图表与视觉：用什么图、图上标什么、配色是否受既有规范约束',
        en: 'charts and visuals: which chart type, what each chart must label, and whether colours are constrained',
        slots: { zh: ['图表类型', '标注与单位', '配色'], en: ['chart type', 'labels and units', 'colour scheme'] },
      },
      {
        id: 'delivery',
        zh: '交付形态：文件格式、是否要可编辑、是否需要讲稿或备注页',
        en: 'the delivery form: file format, whether it must stay editable, and whether speaker notes are needed',
        slots: { zh: ['文件格式', '可编辑要求', '讲稿与备注'], en: ['file format', 'editable requirement', 'speaker notes'] },
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
