import { freezeDeep } from './utils.js'
import { pickLocalized } from './prompt.js'

export function createLocalModelProvider() {
  return {
    id: 'local',
    supportsStructuredOutput: true,
    async complete({ draft, analysis, framework, locale = 'en', iteration, context, mode = 'standard' }) {
      const commandPrefix = draft.command === null ? '' : `${draft.command.token}\n`
      const lines = []
      let firstSectionSeen = false

      for (const section of framework.sections) {
        const content = renderSection({
          section,
          draft,
          analysis,
          locale,
          iteration,
          isFirst: firstSectionSeen === false,
        })
        firstSectionSeen = true
        if (content === undefined) continue
        lines.push(`[${pickLocalized(section.title, locale)}]\n${content}`)
      }

      if (iteration?.feedback !== undefined && iteration.feedback.trim().length > 0) {
        lines.push(`[${locale === 'zh' ? '迭代反馈' : 'Iteration feedback'}]\n${iteration.feedback.trim()}`)
      }

      const enhancedPrompt = `${commandPrefix}${lines.join('\n\n')}`.trim()
      const openQuestions = analysis.openQuestions.map(question => ({
        question: locale === 'zh' ? (question.zh ?? question.question) : (question.question ?? question.zh),
        reason: `heuristic:${question.source}`,
      }))
      const usedContext = (context?.files ?? []).map(file => file.id)

      return {
        content: JSON.stringify({
          enhancedPrompt,
          openQuestions,
          assumptions: [],
          usedContext,
        }),
        model: { provider: 'local', model: 'deterministic-local' },
      }
    },
  }
}

function renderSection({ section, draft, analysis, locale, iteration, isFirst }) {
  if (section.id === 'goal' || isFirst) {
    return draft.naturalText.trim().length > 0 ? draft.naturalText.trim() : draft.originalText.trim()
  }
  if (section.id === 'constraints' || section.id === 'non-goals') {
    if (analysis.constraints.length === 0) return undefined
    return analysis.constraints.map(constraint => `- ${constraint.anchor}`).join('\n')
  }
  if (section.id === 'open-questions') {
    if (analysis.openQuestions.length === 0) return undefined
    return analysis.openQuestions
      .slice(0, 3)
      .map(question => `- ${locale === 'zh' ? (question.zh ?? question.question) : (question.question ?? question.zh)}`)
      .join('\n')
  }
  if (section.id === 'iteration' || section.id === 'feedback') {
    const feedback = iteration?.feedback?.trim()
    return feedback === undefined || feedback.length === 0 ? undefined : feedback
  }
  if (section.id === 'attachments') {
    if (analysis.attachmentCount === 0) return undefined
    return locale === 'zh'
      ? `当前草稿包含 ${analysis.attachmentCount} 个附件（内容未读取）。`
      : `The current draft has ${analysis.attachmentCount} attachment(s); their content was not read.`
  }
  return undefined
}

export function localProviderResult(value) {
  return freezeDeep(value)
}
