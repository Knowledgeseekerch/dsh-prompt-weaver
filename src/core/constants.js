export const PLUGIN_ID = 'dsh-prompt-weaver'
export const PACKAGE_ID = 'dsh-prompt-weaver'
export const SERVICE_NAME = 'promptWeaver'
export const REMOTE_NAMESPACE = SERVICE_NAME
export const ENGINE_VERSION = '0.1.0'
export const CONFIG_SCHEMA_VERSION = 1
export const FRAMEWORK_SCHEMA_VERSION = 1
export const EXPORT_SCHEMA_VERSION = 1
export const MAX_FRAMEWORKS = 100
export const MAX_IMPORT_BYTES = 1024 * 1024

export const MODES = Object.freeze(['minimal', 'standard', 'strict'])

export const TASK_TYPES = Object.freeze([
  'general',
  'question',
  'code',
  'debug',
  'review',
  'test',
  'docs',
  'research',
  'writing',
  'automation',
])

export const INTEGER_RANGES = Object.freeze({
  maxDraftChars: [200, 50000],
  maxOutputTokens: [128, 16384],
  timeoutMs: [1000, 180000],
  maxIterations: [1, 10],
  maxConversationMessages: [0, 50],
  maxConversationChars: [0, 50000],
})

export const CONTEXT_INTEGER_RANGES = Object.freeze({
  maxFiles: [0, 30],
  maxFileBytes: [1024, 262144],
  maxTotalBytes: [4096, 524288],
  maxTreeEntries: [0, 1000],
  maxScanDirs: [0, 2000],
  maxIndexFiles: [0, 20000],
  maxIndexSources: [0, 8000],
  maxIndexedFileBytes: [1024, 1048576],
  maxDepth: [0, 10],
})

export const PRIVACY_INTEGER_RANGES = Object.freeze({
  maxRedactions: [1, 1000],
})

export const DEFAULT_CONFIG = Object.freeze({
  mode: 'standard',
  // 草稿没命中内置领域时，多调一次模型自举「该回答哪些维度」。
  // 内置库覆盖常见领域走零成本快路径，这里只负责长尾。
  autoDomains: true,
  defaultFramework: 'auto',
  maxDraftChars: 20000,
  maxResultChars: 40000,
  maxOutputTokens: 8192,
  maxOutputTokensCap: 16000,
  // 总时限硬顶。0.4.0 之后系统提示词接近一万字符，45 秒会把一次
  // 正常流式返回的请求砍断（"用flask做一个登录页" 就撞过这个）。
  // 真正抓卡死的是 idleTimeoutMs，这里只做兜底。
  timeoutMs: 120000,
  // 空闲超时：只衡量「多久没有新进展」，不限制总时长。
  // 模型持续吐字就一直等，连续这么久没有任何 token 才判定卡死。
  // 这比固定的总时限可靠：长任务不会被误杀，真卡住时又能及时中断。
  idleTimeoutMs: 20000,
  temperature: 0.2,
  maxIterations: 5,
  includeAssistantMessages: false,
  maxConversationMessages: 4,
  maxConversationChars: 2000,
  context: Object.freeze({
    enabled: true,
    maxFiles: 2,
    maxFileBytes: 16384,
    maxTotalBytes: 16384,
    maxTreeEntries: 160,
    maxScanDirs: 600,
    maxIndexFiles: 10000,
    maxIndexSources: 1200,
    maxIndexedFileBytes: 262144,
    maxDepth: 7,
  }),
  privacy: Object.freeze({
    redactSecrets: true,
    blockSensitiveDraft: true,
    maxRedactions: 200,
  }),
  persistFrameworks: false,
})
