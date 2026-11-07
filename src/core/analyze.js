import { TASK_TYPES } from './constants.js'
import { freezeDeep, scriptCounts } from './utils.js'

const TASK_KEYWORDS = Object.freeze({
  code: ['代码', '实现', '函数', '类', '接口', '模块', '重构', '编译', '类型', 'api', '依赖', 'code', 'implement', 'function', 'class', 'module', 'refactor', 'compile', 'typescript', 'javascript', 'python'],
  debug: ['报错', '错误', '失败', '异常', '崩溃', '调试', '修复', '问题', '登录', 'bug', 'error', 'exception', 'crash', 'fail', 'debug', 'fix', 'stack trace'],
  review: ['审查', '评审', 'review', 'code review', '检查代码', 'audit'],
  test: ['测试', '单元测试', '用例', 'test', 'unit test', 'coverage', 'vitest', 'jest'],
  docs: ['文档', '注释', 'readme', 'document', 'documentation', 'comment'],
  research: ['调研', '研究', '对比', '比较', '论文', '资料', 'research', 'compare', 'survey', 'paper'],
  writing: ['写', '撰写', '文章', '文案', '邮件', '总结', 'write', 'article', 'essay', 'email', 'summary'],
  automation: ['脚本', '自动化', '流水线', '工作流', 'script', 'automation', 'workflow', 'ci', 'pipeline'],
})

const CONSTRAINT_MARKERS = [
  '必须', '不要', '不能', '不得', '只能', '禁止', '避免', '务必', '尽量', '至少', '最多', '不超过',
  'must', 'must not', 'shall', 'shall not', 'do not', "don't", 'dont', 'only', 'never', 'avoid', 'at least', 'at most', 'no more than',
]

const VAGUE_PRONOUNS = ['这个', '那个', '它们', '它', '这', '那', 'this', 'that', 'it', 'these', 'those']
const VAGUE_ACTIONS = ['优化', '改进', '处理', '修复', '看看', '弄', '调整', 'fix', 'improve', 'handle', 'clean up', 'optimize']

export function analyzeDraft(draft) {
  const text = draft.originalText
  const task = detectTaskType(text)
  const constraints = extractConstraints(text)
  const openQuestions = extractOpenQuestions(draft, task.type)
  const language = detectLanguage(text)
  return freezeDeep({
    taskType: task.type,
    taskConfidence: task.confidence,
    language,
    constraints,
    openQuestions,
    attachmentCount: draft.attachmentCount,
  })
}

export function detectLanguage(text) {
  const counts = scriptCounts(text)
  const letters = counts.cjk + counts.latin + counts.cyrillic + counts.arabic + counts.devanagari + counts.other
  if (letters === 0) return { primary: 'unknown', cjkRatio: 0 }
  const cjkRatio = counts.cjk / letters
  if (cjkRatio >= 0.15) return { primary: 'zh', cjkRatio }
  if (counts.latin / letters >= 0.6) return { primary: 'en', cjkRatio }
  if (counts.cyrillic > 0) return { primary: 'cyrillic', cjkRatio }
  if (counts.arabic > 0) return { primary: 'arabic', cjkRatio }
  if (counts.devanagari > 0) return { primary: 'devanagari', cjkRatio }
  return { primary: 'other', cjkRatio }
}

export function detectTaskType(text) {
  const normalized = text.toLowerCase()
  const scores = new Map()
  for (const [type, keywords] of Object.entries(TASK_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      if (!normalized.includes(keyword.toLowerCase())) continue
      score += keyword.length > 3 ? 2 : 1
    }
    if (score > 0) scores.set(type, score)
  }
  if (scores.size === 0) return { type: 'general', confidence: 0 }
  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1])
  const total = ranked.reduce((sum, [, score]) => sum + score, 0)
  return { type: ranked[0][0], confidence: ranked[0][1] / total }
}

export function extractConstraints(text) {
  const clauses = splitClauses(text)
  const constraints = []
  const seen = new Set()
  for (const clause of clauses) {
    const marker = findConstraintMarker(clause)
    if (marker === undefined) continue
    const anchor = clause.trim()
    if (anchor.length === 0 || anchor.length > 240 || seen.has(anchor)) continue
    seen.add(anchor)
    constraints.push({
      id: `constraint-${constraints.length + 1}`,
      anchor,
      marker,
      kind: classifyConstraint(anchor, marker),
    })
  }
  return constraints
}

export function extractOpenQuestions(draft, taskType) {
  const questions = []
  const text = draft.originalText.toLowerCase()
  const hasFileReference = draft.segments.some(segment => segment.kind === 'file-reference')
  const hasAcceptance = /验收|验证|测试|预期|acceptance|verify|test|expected/u.test(text)
  const hasOutput = /输出|格式|返回|output|format|return/u.test(text)

  if (VAGUE_PRONOUNS.some(pronoun => text.includes(pronoun.toLowerCase()))) {
    questions.push({
      id: 'question-reference',
      question: 'Which exact object does the pronoun refer to?',
      zh: '代词指代的对象是哪一个？',
      source: 'pronoun',
      confidence: 0.6,
    })
  }
  if (VAGUE_ACTIONS.some(action => text.includes(action.toLowerCase()))) {
    questions.push({
      id: 'question-outcome',
      question: 'What is the expected result or acceptance criterion?',
      zh: '期望结果或验收标准是什么？',
      source: 'vague-action',
      confidence: 0.5,
    })
  }
  if ((taskType === 'code' || taskType === 'debug' || taskType === 'review') && !hasFileReference) {
    questions.push({
      id: 'question-scope',
      question: 'Which file, module, or symbol is in scope?',
      zh: '目标文件、模块或符号是什么？',
      source: 'missing-scope',
      confidence: 0.55,
    })
  }
  if (!hasAcceptance) {
    questions.push({
      id: 'question-verification',
      question: 'How should the result be verified?',
      zh: '结果应如何验证？',
      source: 'missing-verification',
      confidence: 0.35,
    })
  }
  if (!hasOutput) {
    questions.push({
      id: 'question-output',
      question: 'What output or deliverable is expected?',
      zh: '期望的输出或交付物是什么？',
      source: 'missing-output',
      confidence: 0.3,
    })
  }
  return questions.slice(0, 5)
}

function splitClauses(text) {
  return String(text ?? '')
    .split(/[\n。；;！!？?，,]+/u)
    .map(clause => clause.trim())
    .filter(clause => clause.length > 0)
}

function findConstraintMarker(clause) {
  const lower = clause.toLowerCase()
  for (const marker of CONSTRAINT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) return marker
  }
  return undefined
}

function classifyConstraint(anchor, marker) {
  if (/^(?:不要|不能|不得|禁止|避免|do not|don't|dont|never|avoid)/iu.test(anchor) || /must not|shall not/iu.test(anchor)) {
    return 'prohibition'
  }
  if (/^(?:必须|务必|只能|must|shall|only)/iu.test(anchor)) return 'requirement'
  if (/(?:至少|最多|不超过|at least|at most|no more than)/iu.test(anchor) || /\d+/u.test(anchor)) return 'boundary'
  return marker === undefined ? 'general' : 'general'
}
