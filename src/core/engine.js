import { analyzeDraft, extractConstraints } from './analyze.js'
import { MODES } from './constants.js'
import { PromptWeaverError } from './errors.js'
import { TASK_TYPES } from './constants.js'
import { parseMixedDraft } from './draft.js'
import { comparePrompts } from './quality.js'
import { evaluateQuality } from './quality.js'
import { diffSummary } from './diff.js'
import { containsHighConfidenceSecret } from './privacy.js'
import { buildSystemPrompt, buildUserPayload } from './prompt.js'
import { parseModelOutput } from './structured.js'
import { rejectUnknownKeys, requireEnum, requireObject, requireString } from './validate.js'
import { elapsedMs, freezeDeep, nowMs } from './utils.js'

const REQUEST_KEYS = new Set([
  'text',
  'mode',
  'frameworkId',
  'locale',
  'taskType',
  'command',
  'occurrences',
  'attachmentCount',
  'iteration',
  // 前端用于把结果暂存到会话的键；engine 不使用，但必须容忍，
  // 否则 host 与 client 版本错配时会以「未知字段」拒绝整个请求。
  'clientKey',
])

const ITERATION_KEYS = new Set(['round', 'previousText', 'feedback'])

const MEANINGFUL_CHAR = /[\p{L}\p{N}]/u
const GIVE_UP = /^(算了|随便|都行|无所谓|不知道|你看着办|不弄了|没事)[。！!~～\s]*$/u

/** 去掉空白、标点与 emoji 后是否还剩字母或数字。 */
export function hasMeaningfulText(text) {
  return MEANINGFUL_CHAR.test(String(text ?? ''))
}

/** 整句就是一句放弃语，没有可执行意图。 */
export function looksLikeGivingUp(text) {
  return GIVE_UP.test(String(text ?? '').trim())
}

export function createPromptWeaverEngine({
  config,
  frameworkStore,
  provider,
  contextProvider,
  logger,
} = {}) {
  const activeConfig = config
  const store = frameworkStore
  const modelProvider = provider

  async function enhance(request, { signal } = {}) {
    const startedAt = nowMs()
    const input = validateRequest(request, activeConfig)

    if (activeConfig.privacy.blockSensitiveDraft && containsHighConfidenceSecret(input.text)) {
      throw new PromptWeaverError(
        'sensitive-draft',
        'The draft appears to contain credentials or private keys. Remove them or set privacy.blockSensitiveDraft=false.',
      )
    }

    const draft = parseMixedDraft(input)
    if (!draft.hasEnhanceableText) {
      throw new PromptWeaverError(
        'command-only',
        'The draft contains only a slash command. Add natural language after the command to enhance it.',
      )
    }

    // 低信号输入：只有标点、emoji 或空白时直接拒绝，
    // 不替用户凭空生成一个任务（这类输入无从判断真实意图）。
    if (!hasMeaningfulText(input.text)) {
      throw new PromptWeaverError(
        'too-vague',
        'The draft has no meaningful words; describe what you want enhanced.',
      )
    }
    if (looksLikeGivingUp(input.text)) {
      throw new PromptWeaverError(
        'too-vague',
        'The draft looks like a cancelled thought; add what you actually want to do.',
      )
    }

    const baseAnalysis = analyzeDraft(draft)
    const locale = pickOutputLocale(baseAnalysis, input.locale)
    const mode = input.mode ?? activeConfig.mode
    const taskType = normalizeTaskType(input.taskType, baseAnalysis.taskType)
    const framework = store.select({
      taskType,
      mode,
      frameworkId: input.frameworkId ?? activeConfig.defaultFramework,
    })

    const iteration = normalizeIteration(input.iteration, activeConfig)
    const context = contextProvider === undefined
      ? emptyContext()
      : await contextProvider({ draft, config: activeConfig, signal })

    const system = buildSystemPrompt({ mode, framework, locale, maxResultChars: activeConfig.maxResultChars })
    const user = buildUserPayload({ draft, analysis: baseAnalysis, framework, context, iteration, locale })
    const output = await modelProvider.complete({
      system,
      user,
      draft,
      analysis: baseAnalysis,
      framework,
      locale,
      iteration,
      context,
      mode,
      signal,
    })
    const structured = parseModelOutput(output.content, { maxResultChars: activeConfig.maxResultChars })

    // strict 模式仍不接受任何假设；其余模式把假设随结果返回，
    // 由界面展示，避免短草稿因为「模型列了假设」直接不可用。
    if (mode === 'strict' && structured.assumptions.length > 0) {
      throw new PromptWeaverError(
        'unverified-assumption',
        'The model introduced an assumption. Answer the open questions or rewrite the draft, then retry.',
        { assumptions: structured.assumptions },
      )
    }

    const qualityInput = buildQualityInput({ draft, baseAnalysis, iteration })
    const quality = evaluateQuality({
      draft: qualityInput.draft,
      analysis: qualityInput.analysis,
      enhancedPrompt: structured.enhancedPrompt,
      allowedNewTokens: allowedContextTokens(context),
      mode,
    })
    // standard / minimal 模式不再因为门禁失败就丢弃整次结果：
    // 模型每次都给回了可用的增强文本，只是某个阈值没满足。
    // 违规项随结果返回并在界面提示；strict 模式仍保留一票否决。
    if (!quality.passed && mode === 'strict') {
      const describe = (violation) => {
        const item = violation.item
        switch (violation.code) {
          case 'protected-item-lost':
            return `protected-item-lost(${item?.kind ?? '?'}: ${item?.text ?? '?'})`
          case 'constraint-lost':
            return `constraint-lost(${item?.marker ?? '?'})`
          case 'language-changed':
            return `language-changed(${item?.original ?? '?'} -> ${item?.enhanced ?? '?'})`
          case 'invented-reference':
            return `invented-reference(${(item?.references ?? []).map(r => r.text).join(', ')})`
          default:
            return String(violation.code)
        }
      }
      throw new PromptWeaverError(
        'fidelity-check-failed',
        `The enhanced prompt failed the original-intent preservation check: ${quality.violations.map(describe).join('; ')}`,
        { violations: quality.violations },
      )
    }

    const comparison = comparePrompts(draft.originalText, structured.enhancedPrompt)
    const diff = diffSummary(draft.originalText, structured.enhancedPrompt)

    return freezeDeep({
      ok: true,
      text: structured.enhancedPrompt,
      originalText: draft.originalText,
      analysis: publicAnalysis(baseAnalysis),
      openQuestions: structured.openQuestions,
      assumptions: structured.assumptions,
      usedContext: structured.usedContext,
      quality,
      violations: quality.violations,
      comparison,
      diff,
      context: contextSummary(context),
      model: output.model,
      mode,
      framework: framework.id,
      locale,
      iteration: iteration === undefined
        ? { round: 0, max: activeConfig.maxIterations, canIterate: true }
        : { round: iteration.round, max: activeConfig.maxIterations, canIterate: iteration.round < activeConfig.maxIterations },
      elapsedMs: elapsedMs(startedAt),
    })
  }

  function compare(original, enhanced) {
    requireString(original, 'original', { minLength: 1 })
    requireString(enhanced, 'enhanced', { minLength: 1 })
    return comparePrompts(original, enhanced)
  }

  function validateRequest(request, config) {
    requireObject(request, 'request')
    rejectUnknownKeys(request, REQUEST_KEYS, 'request')
    const text = requireString(request.text, 'request.text', { minLength: 1 })
    if (text.length > config.maxDraftChars) {
      throw new PromptWeaverError('too-long', `The draft exceeds the ${config.maxDraftChars} character limit.`)
    }
    const normalized = { text }
    if (request.mode !== undefined) normalized.mode = requireEnum(request.mode, MODES, 'request.mode')
    if (request.frameworkId !== undefined) {
      normalized.frameworkId = requireString(request.frameworkId, 'request.frameworkId', { minLength: 1, maxLength: 100 })
    }
    if (request.locale !== undefined) normalized.locale = requireEnum(request.locale, ['zh', 'en'], 'request.locale')
    if (request.taskType !== undefined) {
      normalized.taskType = requireString(request.taskType, 'request.taskType', { minLength: 1, maxLength: 50 })
    }
    if (request.command !== undefined) {
      normalized.command = requireString(request.command, 'request.command', { minLength: 1, maxLength: 200 })
    }
    if (request.occurrences !== undefined) {
      if (!Array.isArray(request.occurrences) || request.occurrences.length > 100) {
        throw new PromptWeaverError('invalid-value', 'request.occurrences must be an array of at most 100 items.')
      }
      normalized.occurrences = request.occurrences
    }
    if (request.attachmentCount !== undefined) {
      if (!Number.isInteger(request.attachmentCount) || request.attachmentCount < 0 || request.attachmentCount > 1000) {
        throw new PromptWeaverError('invalid-value', 'request.attachmentCount must be an integer from 0 to 1000.')
      }
      normalized.attachmentCount = request.attachmentCount
    }
    if (request.iteration !== undefined) normalized.iteration = request.iteration
    return normalized
  }

  function normalizeIteration(iteration, config) {
    if (iteration === undefined) return undefined
    requireObject(iteration, 'request.iteration')
    rejectUnknownKeys(iteration, ITERATION_KEYS, 'request.iteration')
    const round = iteration.round === undefined ? 1 : iteration.round
    if (!Number.isInteger(round) || round < 1 || round > config.maxIterations) {
      throw new PromptWeaverError('invalid-iteration', `iteration.round must be an integer from 1 to ${config.maxIterations}.`)
    }
    const previousText = requireString(iteration.previousText, 'request.iteration.previousText', { minLength: 1, maxLength: config.maxResultChars })
    const feedback = requireString(iteration.feedback, 'request.iteration.feedback', { minLength: 1, maxLength: 4000 })
    return { round, previousText, feedback }
  }

  function normalizeTaskType(requested, detected) {
    if (requested === undefined || requested === 'auto') return detected
    // 非法值不再静默退化成 general：直接报错，并列出合法取值。
    if (!TASK_TYPES.includes(requested)) {
      throw new PromptWeaverError(
        'invalid-value',
        `request.taskType must be one of: ${TASK_TYPES.join(', ')}.`,
      )
    }
    return requested
  }

  function pickOutputLocale(analysis, requested) {
    // 显式请求优先：调用方明确指定输出语言就照办。
    // 原先两条语言分支都先于 requested 返回，等于显式 locale 只在语言未知时才生效。
    if (requested !== undefined) return requested
    if (analysis.language.primary === 'zh') return 'zh'
    return 'en'
  }

  function buildQualityInput({ draft, baseAnalysis, iteration }) {
    if (iteration === undefined) return { draft, analysis: baseAnalysis }
    const feedbackDraft = parseMixedDraft(iteration.feedback)
    const protectedItems = [
      ...draft.protectedItems,
      ...feedbackDraft.protectedItems.filter(item => item.kind !== 'command'),
    ]
    return {
      draft: freezeDeep({ ...draft, protectedItems }),
      analysis: freezeDeep({
        ...baseAnalysis,
        constraints: [...baseAnalysis.constraints, ...extractConstraints(iteration.feedback)],
      }),
    }
  }

  function allowedContextTokens(context) {
    return [
      ...(context?.files ?? []).map(file => file.path),
      ...(context?.tree ?? []),
    ]
  }

  function publicAnalysis(analysis) {
    return {
      taskType: analysis.taskType,
      taskConfidence: analysis.taskConfidence,
      language: analysis.language,
      constraints: analysis.constraints,
      openQuestions: analysis.openQuestions,
      attachmentCount: analysis.attachmentCount,
    }
  }

  function contextSummary(context) {
    return {
      projectAvailable: Boolean(context?.projectAvailable),
      filePaths: (context?.files ?? []).map(file => file.path),
      conversationMessages: context?.conversationMessages ?? 0,
      redactions: context?.redactions?.length ?? 0,
      totalBytes: context?.totalBytes ?? 0,
      warning: context?.warning,
    }
  }

  function emptyContext() {
    return {
      projectAvailable: false,
      files: [],
      tree: [],
      conversation: [],
      conversationMessages: 0,
      redactions: [],
      totalBytes: 0,
    }
  }

  if (logger !== undefined && typeof logger.debug === 'function') {
    logger.debug('dsh-prompt-weaver engine created')
  }

  return freezeDeep({
    enhance,
    compare,
    config: activeConfig,
    frameworks: store,
    provider: modelProvider,
  })
}
