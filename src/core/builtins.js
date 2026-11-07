import { freezeDeep } from './utils.js'

export const BUILTIN_FRAMEWORKS = freezeDeep([
  {
    schemaVersion: 1,
    id: 'general',
    name: { zh: '通用结构', en: 'General structure' },
    description: {
      zh: '适合大多数任务：目标、上下文、约束、待确认问题、输出与验证。',
      en: 'Suitable for most tasks: goal, context, constraints, open questions, output, and validation.',
    },
    taskTypes: ['general'],
    sections: [
      section('goal', '目标', 'Goal', '用户要完成的一件事；只重述已有意图，不添加新需求。', 'The one thing the user wants; restate the existing intent only and add no new requirements.'),
      section('context', '上下文', 'Context', '仅使用草稿和参考材料中出现的信息。', 'Use only information present in the draft and reference material.'),
      section('constraints', '约束', 'Constraints', '逐条保留用户原有约束；没有就省略本节。', 'Preserve each user constraint verbatim; omit this section if none exist.'),
      section('open-questions', '待确认', 'Open questions', '只列出影响执行的缺失信息，不假设答案。', 'List only missing information that affects execution; do not invent answers.'),
      section('output', '输出', 'Output', '描述用户明确要求的交付物或回复形态。', 'Describe the deliverable or response form explicitly requested by the user.'),
      section('validation', '验证', 'Validation', '只写用户已有的验证方式；缺失时列入待确认。', 'Include only verification the user already provided; otherwise move it to open questions.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'concise',
    name: { zh: '极简', en: 'Concise' },
    description: {
      zh: '只保留目标、约束和待确认，适合已经清楚的短草稿。',
      en: 'Keeps only goal, constraints, and open questions for already-clear short drafts.',
    },
    taskTypes: ['general'],
    sections: [
      section('goal', '目标', 'Goal', '一句话重述用户目标。', 'Restate the user goal in one sentence.'),
      section('constraints', '约束', 'Constraints', '逐条保留原有约束。', 'Preserve original constraints verbatim.'),
      section('open-questions', '待确认', 'Open questions', '最多三问，只问影响执行的信息。', 'At most three questions, only for execution-critical information.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'engineering',
    name: { zh: '工程实现', en: 'Engineering' },
    description: {
      zh: '面向功能实现与重构：目标、范围、现状、期望、约束、验收。',
      en: 'For implementation and refactoring: goal, scope, current behavior, expected behavior, constraints, and acceptance.',
    },
    taskTypes: ['code', 'automation'],
    sections: [
      section('goal', '目标', 'Goal', '说明要实现的变更，不扩大需求。', 'State the change to implement without expanding the request.'),
      section('scope', '范围', 'Scope', '列出用户点名的文件、模块、符号和边界。', 'List files, modules, symbols, and boundaries explicitly named by the user.'),
      section('current', '现状', 'Current behavior', '只描述用户或参考材料说明的现状。', 'Describe only behavior stated by the user or reference material.'),
      section('expected', '期望行为', 'Expected behavior', '给出可观察的期望结果。', 'Give an observable expected result.'),
      section('constraints', '约束与非目标', 'Constraints and non-goals', '保留技术约束、兼容性要求和明确的非目标。', 'Preserve technical constraints, compatibility requirements, and explicit non-goals.'),
      section('validation', '验收与验证', 'Acceptance and validation', '写用户提供的测试或验收方式；缺失时列为待确认。', 'Include tests or acceptance criteria supplied by the user; otherwise list as an open question.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'debugging',
    name: { zh: '问题诊断', en: 'Debugging' },
    description: {
      zh: '面向报错与故障：症状、复现、期望、证据、约束、验证。',
      en: 'For errors and failures: symptom, reproduction, expectation, evidence, constraints, and validation.',
    },
    taskTypes: ['debug'],
    sections: [
      section('symptom', '症状', 'Symptom', '保留原始错误信息、触发条件和影响范围。', 'Preserve original error text, trigger conditions, and impact scope.'),
      section('reproduction', '复现步骤', 'Reproduction', '只整理用户已有步骤，不编造步骤。', 'Organize only steps the user already provided; do not invent steps.'),
      section('expected', '期望与实际', 'Expected and actual', '对比用户描述的期望与实际结果。', 'Compare expected and actual results as described by the user.'),
      section('evidence', '证据', 'Evidence', '保留日志、堆栈、版本、环境等已有证据。', 'Preserve existing logs, stacks, versions, and environment details.'),
      section('constraints', '约束', 'Constraints', '保留排查边界、只读要求和非目标。', 'Preserve investigation boundaries, read-only requirements, and non-goals.'),
      section('validation', '验证', 'Validation', '说明修复后如何确认。', 'State how the fix will be confirmed.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'review',
    name: { zh: '审查', en: 'Review' },
    description: {
      zh: '面向代码或文档审查：范围、关注点、标准、输出。',
      en: 'For code or document review: scope, focus, standards, and output.',
    },
    taskTypes: ['review'],
    sections: [
      section('scope', '范围', 'Scope', '列出待审查对象与明确排除项。', 'List review targets and explicit exclusions.'),
      section('focus', '关注点', 'Focus', '保留用户关心的正确性、安全性、性能等维度。', 'Preserve user concerns such as correctness, security, and performance.'),
      section('standards', '标准', 'Standards', '仅引用用户或参考材料给出的标准。', 'Reference only standards supplied by the user or reference material.'),
      section('constraints', '约束', 'Constraints', '保留只读、不改代码、输出格式等约束。', 'Preserve read-only, no-code-change, and output-format constraints.'),
      section('output', '输出', 'Output', '按要求组织发现、严重程度和建议。', 'Organize findings, severity, and suggestions as requested.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'testing',
    name: { zh: '测试', en: 'Testing' },
    description: {
      zh: '面向测试设计与补充：范围、行为、用例、约束、输出。',
      en: 'For test design: scope, behavior, cases, constraints, and output.',
    },
    taskTypes: ['test'],
    sections: [
      section('scope', '范围', 'Scope', '说明被测对象与边界。', 'State the unit under test and boundaries.'),
      section('behavior', '行为', 'Behavior', '整理用户描述的预期行为。', 'Organize expected behavior described by the user.'),
      section('cases', '用例', 'Cases', '只覆盖用户要求的场景；未要求的不新增。', 'Cover only scenarios requested by the user; add no unrequested scenarios.'),
      section('constraints', '约束', 'Constraints', '保留测试框架、覆盖率、运行环境要求。', 'Preserve test framework, coverage, and environment requirements.'),
      section('output', '输出', 'Output', '说明期望的测试产物。', 'State the expected test artifacts.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'research',
    name: { zh: '调研', en: 'Research' },
    description: {
      zh: '面向信息调研与方案对比：问题、范围、证据、输出、验证。',
      en: 'For research and comparisons: question, scope, evidence, output, and validation.',
    },
    taskTypes: ['research'],
    sections: [
      section('question', '研究问题', 'Research question', '明确要回答的问题。', 'State the question to answer.'),
      section('scope', '范围', 'Scope', '限定时间、地域、语言、候选方案等边界。', 'Bound time, region, language, candidates, and other limits.'),
      section('evidence', '证据标准', 'Evidence', '保留用户要求的来源、数据与引用规则。', 'Preserve source, data, and citation rules requested by the user.'),
      section('constraints', '约束', 'Constraints', '保留篇幅、语言、禁止事项等约束。', 'Preserve length, language, prohibitions, and other constraints.'),
      section('output', '输出', 'Output', '说明要求的呈现形式。', 'State the requested presentation form.'),
      section('validation', '验证', 'Validation', '说明如何核对结论。', 'State how conclusions will be checked.'),
    ],
  },
  {
    schemaVersion: 1,
    id: 'writing',
    name: { zh: '写作', en: 'Writing' },
    description: {
      zh: '面向文章、文案与总结：目标、受众、素材、风格、约束、输出。',
      en: 'For articles, copy, and summaries: goal, audience, material, style, constraints, and output.',
    },
    taskTypes: ['writing', 'docs'],
    sections: [
      section('goal', '写作目标', 'Goal', '说明文体、主题和用途。', 'State the form, topic, and purpose.'),
      section('audience', '受众', 'Audience', '仅使用用户给出的受众信息。', 'Use only audience information supplied by the user.'),
      section('material', '素材', 'Material', '整理草稿中已有的事实与素材。', 'Organize facts and material already in the draft.'),
      section('style', '风格', 'Style', '保留用户指定的语气、长度和格式要求。', 'Preserve user-specified tone, length, and format requirements.'),
      section('constraints', '约束', 'Constraints', '保留禁止编造、引用规则、语言等要求。', 'Preserve no-fabrication, citation, and language requirements.'),
      section('output', '输出', 'Output', '说明交付形式。', 'State the deliverable form.'),
    ],
  },
])

function section(id, zhTitle, enTitle, zhGuidance, enGuidance) {
  return {
    id,
    title: { zh: zhTitle, en: enTitle },
    guidance: { zh: zhGuidance, en: enGuidance },
    required: false,
  }
}
