import { analyzeDraft, extractConstraints } from './analyze.js'
import { MODES } from './constants.js'
import { PromptWeaverError } from './errors.js'
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
])

const ITERATION_KEYS = new Set(['round', 'previousText', 'feedback'])

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

    if (structured.assumptions.length > 0) {
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
    if (!quality.passed) {
      throw new PromptWeaverError(
        'fidelity-check-failed',
        'The enhanced prompt failed the original-intent preservation check.',
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
      usedContext: structured.usedContext,
      quality,
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
    return requested
  }

  function pickOutputLocale(analysis, requested) {
    if (analysis.language.primary === 'zh') return 'zh'
    if (analysis.language.primary === 'en') return 'en'
    return requested ?? (analysis.language.primary === 'unknown' ? 'en' : 'en')
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
