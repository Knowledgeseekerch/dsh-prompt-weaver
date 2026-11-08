window.__ModuleLoader__.load({
  id: 'dsh-prompt-weaver',
  factory(require) {
    const React = require('react')
    const { Toast } = require('@deepseek-ai/dsh-client-ui-primitives')
    // 面板要挂到 body 上：slot 容器会捕获 position:fixed（祖先的 transform/contain），
    // 不这样做全屏遮罩会被压进 28px 的按钮格子里，看起来就是「按钮变成了黑点」。
    // 拿不到 react-dom 就退回内联渲染，至少不比原来更差。
    let ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch {
      ReactDOM = null
    }
    const h = React.createElement
    const NS = 'promptWeaver'
    const ENDPOINT = 'promptWeaver/enhance'
    const LIST_ENDPOINT = 'promptWeaver/listFrameworks'
    const IMPORT_ENDPOINT = 'promptWeaver/importConfig'
    const EXPORT_ENDPOINT = 'promptWeaver/exportConfig'
    const TAKE_PENDING_ENDPOINT = 'promptWeaver/takePending'
    const CLEAR_PENDING_ENDPOINT = 'promptWeaver/clearPending'
    const MAX_HISTORY = 5
    const MAX_IMPORT_CHARS = 1024 * 1024

    const en = {
      action: 'Open Prompt Weaver',
      loading: 'Enhancing prompt…',
      panelTitle: 'Prompt Weaver',
      original: 'Original draft',
      enhanced: 'Enhanced prompt',
      mode: 'Mode',
      framework: 'Framework',
      minimal: 'Minimal',
      standard: 'Standard',
      strict: 'Strict',
      enhance: 'Enhance',
      apply: 'Replace draft',
      undo: 'Undo',
      iterate: 'Iterate',
      feedback: 'Feedback for the next iteration',
      feedbackPlaceholder: 'Explain what is still wrong. This is treated as a constraint.',
      compare: 'Compare',
      diff: 'Unified diff',
      quality: 'Quality checks',
      import: 'Import',
      export: 'Export',
      close: 'Close',
      busy: 'The composer is busy',
      empty: 'Type a prompt first',
      attachments: 'Attachments preserved',
      commandOnly: 'Add text after the slash command to enhance it.',
      unavailable: 'Prompt Weaver is unavailable here',
      failed: 'The model could not enhance this prompt',
      applied: 'Draft replaced. Nothing was sent.',
      deviations: 'deviation(s)',
      undone: 'Previous version restored.',
      discarded: 'The draft changed, so this result was discarded.',
      imported: 'Configuration imported.',
      exported: 'Configuration exported.',
      tooLong: 'The draft is too long.',
      sensitive: 'The draft appears to contain credentials or private keys.',
      protected: 'Protected items',
      constraints: 'Constraints',
      openQuestions: 'Open questions',
      score: 'Heuristic score',
      context: 'Context',
      noFrameworks: 'No frameworks available',
      iteration: 'Iteration',
      failedGate: 'The result failed the original-intent check.',
      copy: 'Copy',
      copied: 'Copied to clipboard.',
      copyFailed: 'Copy failed.',
      assumptions: 'Assumptions',
      completeness: 'Unanswered requirements',
      premiseTitle: 'The premise does not hold',
      premiseAlternative: 'What to do instead',
      unprobed: 'No check rules for this domain yet, so nothing was measured.',
      coverage: 'coverage',
      mustSpecify: 'Must specify first',
      shouldSpecify: 'Should specify',
      couldSpecify: 'Worth specifying',
      noGaps: 'Nothing blocking left to specify.',
    }

    const zh = {
      action: '打开 Prompt Weaver',
      loading: '正在增强提示词…',
      panelTitle: 'Prompt Weaver 提示词编织台',
      original: '原始草稿',
      enhanced: '增强结果',
      mode: '模式',
      framework: '框架',
      minimal: '极简',
      standard: '标准',
      strict: '严格',
      enhance: '增强',
      apply: '替换草稿',
      undo: '撤销',
      iterate: '继续迭代',
      feedback: '下一轮反馈',
      feedbackPlaceholder: '说明还有什么问题。反馈会被当作约束处理。',
      compare: '对比',
      diff: '差异',
      quality: '质量检查',
      import: '导入',
      export: '导出',
      close: '关闭',
      busy: '输入框正在忙',
      empty: '请先输入提示词',
      attachments: '附件保持不变',
      commandOnly: '请在斜杠命令后补充自然语言。',
      unavailable: '当前环境不支持 Prompt Weaver',
      failed: '模型未能增强这条提示词',
      applied: '草稿已替换，未自动发送。',
      deviations: '处偏离',
      undone: '已恢复上一版。',
      discarded: '草稿已变化，本次结果已丢弃。',
      imported: '配置已导入。',
      exported: '配置已导出。',
      tooLong: '当前提示词过长。',
      sensitive: '草稿可能包含凭据或私钥。',
      protected: '受保护项',
      constraints: '约束',
      openQuestions: '待确认',
      score: '启发式评分',
      context: '上下文',
      noFrameworks: '没有可用框架',
      iteration: '迭代',
      failedGate: '结果未通过原意保留检查。',
      copy: '复制',
      copied: '已复制到剪贴板。',
      copyFailed: '复制失败。',
      assumptions: '模型补充的前提',
      completeness: '需求缺口',
      premiseTitle: '前提不成立',
      premiseAlternative: '建议改成',
      unprobed: '该领域暂无检查规则，未做缺口判定。',
      coverage: '覆盖度',
      mustSpecify: '必须先定',
      shouldSpecify: '建议明确',
      couldSpecify: '可以补充',
      noGaps: '没有必须补的缺口。',
    }

    const css = `
.dsh-pw-root {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: none;
}
.dsh-pw-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, opacity 120ms ease;
}
.dsh-pw-button:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh-pw-button:disabled {
  opacity: 0.38;
  cursor: default;
}
.dsh-pw-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay, #000) 72%, transparent);
  backdrop-filter: blur(4px);
}
.dsh-pw-button.is-busy svg {
  animation: dsh-pw-spin 900ms linear infinite;
}
@keyframes dsh-pw-spin {
  to { transform: rotate(360deg); }
}
.dsh-pw-closing {
  animation: dsh-pw-fade-out 420ms ease forwards;
  pointer-events: none;
}
.dsh-pw-panel.dsh-pw-closing {
  animation: dsh-pw-shrink 420ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
  transform-origin: center;
}
@keyframes dsh-pw-shrink {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.12); opacity: 0; }
}
@keyframes dsh-pw-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
.dsh-pw-panel {
  width: min(920px, 100%);
  min-width: min(320px, 92vw);
  max-height: min(88vh, 900px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-2, #1c1c20));
  color: var(--dsw-alias-label-primary, #ececf1);
  box-shadow: 0 18px 60px rgb(0 0 0 / 0.28);
}
.dsh-pw-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.dsh-pw-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-pw-select,
.dsh-pw-input,
.dsh-pw-textarea,
.dsh-pw-button-control {
  font: inherit;
  color: inherit;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 6px 8px;
}
.dsh-pw-textarea {
  min-height: 120px;
  font-family: var(--dsw-font-family-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
}
.dsh-pw-readonly {
  min-height: 72px;
  max-height: 180px;
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  border: 1px dashed var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
}
.dsh-pw-button-control {
  cursor: pointer;
}
.dsh-pw-button-control:disabled {
  opacity: 0.5;
  cursor: default;
}
.dsh-pw-list {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.dsh-pw-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-pw-muted {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.dsh-pw-warn {
  color: var(--dsw-alias-state-warning-primary);
}
.dsh-pw-error {
  color: var(--dsw-alias-state-danger-primary);
}
.dsh-pw-ok {
  color: var(--dsw-alias-state-success-primary);
}
.dsh-pw-hidden-input {
  display: none;
}
`

    function SparkleIcon() {
      return h('svg', {
        viewBox: '0 0 20 20',
        width: 16,
        height: 16,
        'aria-hidden': true,
        focusable: false,
      },
      h('path', {
        d: 'M10 2.2l1.7 4.3 4.3 1.7-4.3 1.7L10 14.2 8.3 9.9 4 8.2l4.3-1.7z',
        fill: 'currentColor',
      }),
      h('path', {
        d: 'M15.4 12.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
        fill: 'currentColor',
        opacity: 0.6,
      }))
    }

    // 面板渲染一旦抛错，React 会把整棵子树卸掉——按钮就跟着消失了。
    // 兜住它：渲染失败时显示一条可读的错误，按钮留在原地。
    class PanelBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error }
      }

      render() {
        if (this.state.error === null) return this.props.children
        return h('div', { className: 'dsh-pw-overlay' },
          h('div', { className: 'dsh-pw-panel' },
            h('strong', null, 'Prompt Weaver panel failed to render'),
            h('pre', { className: 'dsh-pw-readonly' }, String(this.state.error?.message ?? this.state.error)),
            h('button', {
              type: 'button',
              className: 'dsh-pw-button-control',
              onClick: this.props.onClose,
            }, 'Close')
          ))
      }
    }

    // 面板挂到 body：slot 容器会捕获 position:fixed，不这样做全屏遮罩
    // 会被压进 28px 的按钮格子里，表现就是「按钮变成一个黑点」。
    function renderOverlay(node) {
      if (ReactDOM?.createPortal === undefined || typeof document === 'undefined') return node
      return ReactDOM.createPortal(node, document.body)
    }

    function WeaverPanel(props) {
      const {
        useInput, inputActions, sessionId, rpc, t, onClose, requestBase, toast, initialResult,
      } = props
      const draft = useInput(state => state.draft) ?? ''
      const phase = useInput(state => state.phase) ?? 'plain'
      const attachmentCount = useInput(state => state.attachmentIds?.length ?? 0) ?? 0
      const occurrences = useInput(state => state.occurrences ?? []) ?? []

      const [mode, setMode] = React.useState('standard')
      const [frameworkId, setFrameworkId] = React.useState('auto')
      const [frameworks, setFrameworks] = React.useState([])
      const [feedback, setFeedback] = React.useState('')
      const [status, setStatus] = React.useState({ kind: 'idle' })
      const [closing, setClosing] = React.useState(false)
      const [result, setResult] = React.useState(initialResult ?? null)
      const [edited, setEdited] = React.useState(initialResult?.text ?? '')
      const [history, setHistory] = React.useState([])
      const [view, setView] = React.useState('enhanced')
      const [importing, setImporting] = React.useState(false)

      const draftRef = React.useRef(draft)
      draftRef.current = draft
      const resultRef = React.useRef(null)
      resultRef.current = result
      const mountedRef = React.useRef(true)
      const abortRef = React.useRef(null)
      const sessionIdRef = React.useRef(sessionId)
      sessionIdRef.current = sessionId

      // 切换会话时重置进行态：旧请求的结果不再属于当前输入框。
      React.useEffect(() => {
        setBusy(false)
        abortRef.current = null
      }, [sessionId])

      // 取回「请求完成时组件已被卸载」的结果：切走再切回来仍能看到并应用。
      React.useEffect(() => {
        if (rpc === undefined || sessionId === undefined) return undefined
        let cancelled = false
        rpc.call('/api', TAKE_PENDING_ENDPOINT, {
          args: { agentId: sessionId, request: { clientKey: sessionId } },
        })
          .then((response) => {
            const value = response?.value ?? response
            if (cancelled || value?.ok !== true || value.result == null) return
            setPendingResult(value.result)
            setOpen(true)
          })
          .catch(() => {})
        return () => { cancelled = true }
      }, [rpc, sessionId])
      const fileInputRef = React.useRef(null)

      React.useEffect(() => {
        mountedRef.current = true
        return () => {
          mountedRef.current = false
          abortRef.current?.abort()
        }
      }, [])

      React.useEffect(() => {
        let cancelled = false
        if (rpc === undefined) return undefined
        Promise.resolve(rpc.call('/api', LIST_ENDPOINT, { args: { agentId: sessionId, request: {} } }))
          .then(response => {
            if (cancelled || !mountedRef.current) return
            const value = response?.value ?? response
            if (value?.ok === true && Array.isArray(value.frameworks)) {
              setFrameworks(value.frameworks)
            }
          })
          .catch(() => {})
        return () => { cancelled = true }
      }, [rpc, sessionId])

      const requestPayload = (iteration) => {
        const base = { ...requestBase }
        if (iteration === undefined) {
          return {
            text: draftRef.current,
            mode,
            frameworkId,
            command: base.command,
            occurrences: base.occurrences,
            attachmentCount,
          }
        }
        return {
          text: resultRef.current?.originalText ?? draftRef.current,
          mode,
          frameworkId,
          command: base.command,
          occurrences: base.occurrences,
          attachmentCount,
          iteration,
        }
      }

      const run = async (iteration) => {
        if (rpc === undefined) {
          toast('error', t('unavailable'))
          return
        }
        const controller = new AbortController()
        abortRef.current?.abort()
        abortRef.current = controller
        setStatus({ kind: 'loading' })
        let response
        try {
          response = await rpc.call('/api', ENDPOINT, {
            args: { agentId: sessionId, request: requestPayload(iteration) },
          }, controller.signal)
        } catch {
          if (controller.signal.aborted) return
          if (abortRef.current === controller) abortRef.current = null
          setStatus({ kind: 'error', message: t('failed') })
          toast('error', t('failed'))
          return
        }
        if (!mountedRef.current || controller.signal.aborted) return
        if (abortRef.current === controller) abortRef.current = null
        const value = response?.value ?? response
        if (value?.ok !== true) {
          const raw = typeof value?.message === 'string' && value.message.length > 0 ? value.message : t('failed')
          const reason = typeof value?.reason === 'string' ? value.reason : undefined
          const message = reason === undefined ? raw : `[${reason}] ${raw}`
          setStatus({ kind: 'error', message })
          toast('error', message)
          return
        }
        const previous = resultRef.current?.text
        if (previous !== undefined && history.length < MAX_HISTORY) {
          setHistory(items => [...items, previous])
        }
        setResult(value)
        setEdited(value.text)
        setView('enhanced')
        setFeedback('')
        setStatus({ kind: 'success' })
        // 写回策略必须与一键增强一致：有违规就只把结果留在面板里，不落草稿。
        // 否则用户改从面板走一遍，就能把丢了保护项/约束的结果直接盖进输入框，
        // 而一键增强那条路径明明是拦着的——同一条插件不该有两套门禁。
        if (!canApplyResult(value)) {
          setStatus({ kind: 'error', message: t('failed') })
          toast('error', t('failed'))
          return
        }
        // 结果直接写回输入框，然后面板收缩淡出，回落到会话。
        let applied = false
        if (typeof inputActions?.setDraft === 'function') {
          try {
            inputActions.setDraft(value.text)
            toast('success', t('applied'))
            applied = true
          } catch {
            // 写回异常时保留面板内的结果，用户仍可手动点「应用」
          }
        }
        // 只有写回成功才收起面板；写回失败时留在面板里，避免结果看不见
        if (applied) {
          setClosing(true)
          window.setTimeout(() => {
            if (mountedRef.current) onClose()
          }, 420)
        }
      }

      const apply = () => {
        if (typeof inputActions?.setDraft !== 'function') {
          toast('error', t('unavailable'))
          return
        }
        if (draftRef.current !== (resultRef.current?.originalText ?? '')) {
          setStatus({ kind: 'error', message: t('discarded') })
          toast('error', t('discarded'))
          return
        }
        inputActions.setDraft(edited)
        toast('success', t('applied'))
        onClose()
      }

      const undo = () => {
        if (history.length === 0) return
        const previous = history[history.length - 1]
        setHistory(items => items.slice(0, -1))
        setEdited(previous)
        if (resultRef.current !== null) {
          setResult({ ...resultRef.current, text: previous })
        }
        // 撤销时同步回写输入框，避免面板内容与输入框不一致
        if (typeof inputActions?.setDraft === 'function') inputActions.setDraft(previous)
        toast('success', t('undone'))
      }

      // 结果只落在 textarea 里，想单独拿出去粘贴时不必手动全选。
      const copyResult = async () => {
        try {
          if (navigator?.clipboard?.writeText === undefined) throw new Error('clipboard unavailable')
          await navigator.clipboard.writeText(edited)
          toast('success', t('copied'))
        } catch {
          toast('error', t('copyFailed'))
        }
      }

      const doImport = async (file) => {
        if (rpc === undefined) {
          toast('error', t('unavailable'))
          return
        }
        if (file.size > MAX_IMPORT_CHARS) {
          toast('error', t('failed'))
          return
        }
        setImporting(true)
        try {
          const text = await file.text()
          let bundle
          try {
            bundle = JSON.parse(text)
          } catch {
            toast('error', t('failed'))
            return
          }
          const response = await rpc.call('/api', IMPORT_ENDPOINT, {
            args: { agentId: sessionId, request: { bundle, conflict: 'replace' } },
          })
          const value = response?.value ?? response
          if (value?.ok === true) {
            const list = await rpc.call('/api', LIST_ENDPOINT, { args: { agentId: sessionId, request: {} } })
            const listValue = list?.value ?? list
            if (listValue?.ok === true && Array.isArray(listValue.frameworks)) setFrameworks(listValue.frameworks)
            toast('success', t('imported'))
          } else {
            toast('error', typeof value?.message === 'string' ? value.message : t('failed'))
          }
        } catch {
          toast('error', t('failed'))
        } finally {
          if (mountedRef.current) setImporting(false)
        }
      }

      const doExport = async () => {
        if (rpc === undefined) {
          toast('error', t('unavailable'))
          return
        }
        try {
          const response = await rpc.call('/api', EXPORT_ENDPOINT, { args: { agentId: sessionId, request: {} } })
          const value = response?.value ?? response
          if (value?.ok !== true) {
            toast('error', typeof value?.message === 'string' ? value.message : t('failed'))
            return
          }
          const blob = new Blob([JSON.stringify(value.bundle, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = 'dsh-prompt-weaver-config.json'
          anchor.click()
          URL.revokeObjectURL(url)
          toast('success', t('exported'))
        } catch {
          toast('error', t('failed'))
        }
      }

      const disabled = phase !== 'plain' || draft.trim().length === 0
      const busy = status.kind === 'loading'

      return h('div', {
        className: closing ? 'dsh-pw-overlay dsh-pw-closing' : 'dsh-pw-overlay',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('panelTitle'),
      },
      h('style', null, css),
      h('div', { className: closing ? 'dsh-pw-panel dsh-pw-closing' : 'dsh-pw-panel' },
        h('div', { className: 'dsh-pw-row' },
          h('strong', null, t('panelTitle')),
          h('span', { className: 'dsh-pw-muted' }, `(${t('iteration')}: ${result?.iteration?.round ?? 0})`),
          h('div', { style: { marginLeft: 'auto' } },
            h('button', { type: 'button', className: 'dsh-pw-button-control', onClick: onClose }, t('close'))
          )
        ),
        h('label', { className: 'dsh-pw-field' }, t('original'),
          // 有结果后锁定显示增强前的原文：自动写回会改掉 draft，
          // 不锁定的话原文与结果会显示同一份内容，差异对比就失效了。
          h('div', { className: 'dsh-pw-readonly' }, result?.originalText ?? draft)
        ),
        attachmentCount > 0
          ? h('div', { className: 'dsh-pw-ok' }, `${t('attachments')}: ${attachmentCount}`)
          : null,
        h('div', { className: 'dsh-pw-row' },
          h('label', { className: 'dsh-pw-field' }, t('mode'),
            h('select', {
              className: 'dsh-pw-select',
              value: mode,
              onChange: event => setMode(event.target.value),
            },
              h('option', { value: 'minimal' }, t('minimal')),
              h('option', { value: 'standard' }, t('standard')),
              h('option', { value: 'strict' }, t('strict'))
            )
          ),
          h('label', { className: 'dsh-pw-field' }, t('framework'),
            h('select', {
              className: 'dsh-pw-select',
              value: frameworkId,
              onChange: event => setFrameworkId(event.target.value),
            },
              h('option', { value: 'auto' }, t('framework')),
              frameworks.map(framework => h('option', { key: framework.id, value: framework.id },
                typeof framework.name === 'object'
                  ? (framework.name.zh ?? framework.name.en ?? framework.id)
                  : framework.id
              ))
            )
          ),
          h('button', {
            type: 'button',
            className: 'dsh-pw-button-control',
            disabled: disabled || busy,
            onClick: () => run(undefined),
          }, busy ? t('loading') : t('enhance'))
        ),
        h('div', { className: 'dsh-pw-row' },
          h('button', { type: 'button', className: 'dsh-pw-button-control', onClick: doExport }, t('export')),
          h('button', {
            type: 'button',
            className: 'dsh-pw-button-control',
            disabled: importing,
            onClick: () => fileInputRef.current?.click(),
          }, t('import')),
          h('input', {
            ref: fileInputRef,
            className: 'dsh-pw-hidden-input',
            type: 'file',
            accept: 'application/json,.json',
            onChange: event => {
              const file = event.target.files?.[0]
              if (file !== undefined) doImport(file)
              event.target.value = ''
            },
          })
        ),
        result === null ? null : h('div', { className: 'dsh-pw-list' },
          h('div', { className: 'dsh-pw-row' },
            h('button', { type: 'button', className: 'dsh-pw-button-control', onClick: apply }, t('apply')),
            h('button', { type: 'button', className: 'dsh-pw-button-control', onClick: copyResult }, t('copy')),
            h('button', {
              type: 'button',
              className: 'dsh-pw-button-control',
              disabled: history.length === 0,
              onClick: undo,
            }, t('undo')),
            h('button', {
              type: 'button',
              className: 'dsh-pw-button-control',
              onClick: () => run({
                round: Math.min(MAX_HISTORY, (result.iteration?.round ?? 0) + 1),
                previousText: result.text,
                feedback,
              }),
              disabled: busy || feedback.trim().length === 0 || result.iteration?.canIterate !== true,
            }, t('iterate')),
            h('button', {
              type: 'button',
              className: 'dsh-pw-button-control',
              onClick: () => setView(view === 'diff' ? 'enhanced' : 'diff'),
            }, view === 'diff' ? t('compare') : t('diff'))
          ),
          h('label', { className: 'dsh-pw-field' }, t('enhanced'),
            h('textarea', {
              className: 'dsh-pw-textarea',
              value: edited,
              onChange: event => setEdited(event.target.value),
            })
          ),
          // 只在 diff 视图额外显示对比；否则结果会被 textarea 和 pre 重复渲染两份。
          view === 'diff'
            ? h('pre', { className: 'dsh-pw-readonly' }, renderDiff(result.originalText, edited))
            : null,
          h('label', { className: 'dsh-pw-field' }, t('feedback'),
            h('input', {
              className: 'dsh-pw-input',
              value: feedback,
              placeholder: t('feedbackPlaceholder'),
              onChange: event => setFeedback(event.target.value),
            })
          ),
          renderPremise(result, t),
          renderQuality(result, t),
          renderCompleteness(result, t),
          renderAssumptions(result, t),
          renderAnalysis(result, t),
          renderContext(result, t)
        ),
        status.kind === 'error' ? h('div', { className: 'dsh-pw-error' }, status.message) : null,
        status.kind === 'success' ? h('div', { className: 'dsh-pw-ok' }, t('score') + ': ' + (result?.quality?.score ?? 0)) : null
      ))
    }

    function WeaverButton(props) {
      const { useInput, inputActions, sessionId, t, rpc, showToast } = props
      const draft = useInput(state => state.draft) ?? ''
      const phase = useInput(state => state.phase) ?? 'plain'
      const occurrences = useInput(state => state.occurrences ?? []) ?? []
      const attachmentCount = useInput(state => state.attachmentIds?.length ?? 0) ?? 0
      const [open, setOpen] = React.useState(false)
      const [toast, setToast] = React.useState(null)
      const toastSeq = React.useRef(0)
      const mountedRef = React.useRef(true)

      React.useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
      }, [])

      const toastFn = React.useCallback((kind, text) => {
        if (!mountedRef.current) return
        toastSeq.current += 1
        setToast({ seq: toastSeq.current, kind, text })
        showToast?.(kind, text)
      }, [showToast])

      const requestBase = React.useMemo(() => ({
        command: inferCommand(draft),
        occurrences: occurrences.map(occurrence => ({
          source: occurrence.source,
          ref: occurrence.ref,
          offset: occurrence.offset,
          length: occurrence.length,
          label: occurrence.label,
          appearance: occurrence.appearance,
          clipboardText: occurrence.clipboardText,
        })),
        attachmentCount,
      }), [draft, occurrences, attachmentCount])

      const disabled = phase !== 'plain' || draft.trim().length === 0
      const title = phase !== 'plain' ? t('busy') : draft.trim().length === 0 ? t('empty') : t('action')

      const [busy, setBusy] = React.useState(false)
      const [pendingResult, setPendingResult] = React.useState(null)
      const abortRef = React.useRef(null)
      const sessionIdRef = React.useRef(sessionId)
      sessionIdRef.current = sessionId

      // 一键增强：不弹面板，点一下就跑，结果直接写回输入框。
      // 右键按钮仍可打开完整面板（差异对比、迭代、导入导出）。
      const runDirect = React.useCallback(async () => {
        if (rpc === undefined) {
          toastFn('error', t('unavailable'))
          return
        }
        // 进行中再点一次即取消：没有这个入口，用户只能等三次重试加超时。
        if (busy) {
          abortRef.current?.abort(new Error('cancelled by user'))
          return
        }
        if (disabled) return
        const controller = new AbortController()
        const sessionAtStart = sessionId
        abortRef.current = controller
        setBusy(true)
        try {
          // 模型输出有波动：同一句话可能这次过、下次不过。
          // 对非确定性失败自动重试，确定性失败立即返回。
          const deterministic = new Set(['sensitive-draft', 'command-only', 'too-long', 'invalid-value', 'unavailable', 'no-route'])
          let value
          let lastError
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const response = await rpc.call('/api', ENDPOINT, {
                args: {
                  agentId: sessionId,
                  request: {
                    text: draft,
                    mode: 'standard',
                    frameworkId: 'auto',
                    command: requestBase.command,
                    occurrences: requestBase.occurrences,
                    attachmentCount: requestBase.attachmentCount,
                    clientKey: sessionId,
                  },
                },
              }, controller.signal)
              value = response?.value ?? response
            } catch (error) {
              lastError = error
              value = undefined
            }
            if (value?.ok === true) break
            const reason = value?.reason
            if (reason !== undefined && deterministic.has(reason)) break
          }
          if (value?.ok !== true) {
            const reason = typeof value?.reason === 'string' ? value.reason : undefined
            let message = typeof value?.message === 'string' && value.message.length > 0
              ? value.message
              : undefined
            if (message === undefined) {
              // 没有业务错误对象：说明 rpc 本身失败，把异常形态也带出来。
              const raw = lastError === undefined
                ? 'no response and no error'
                : `${lastError?.name ?? typeof lastError}: ${lastError?.message ?? String(lastError)}`
              message = `rpc failed (${raw.slice(0, 100)})`
            }
            toastFn('error', reason === undefined ? message : `[${reason}] ${message}`)
            return
          }
          const violations = value.violations?.length ?? 0
          const assumptions = value.assumptions?.length ?? 0
          const score = value.quality?.score
          // 违规（丢了保护项、语言变了、臆造引用等）不再阻止写回：
          // 用户点一次增强就该拿到结果，漏一个保护项不该让整次操作看起来失败。
          // 偏离只在 toast 里提示一句，结果仍在面板里可查、可改。
          // 期间切换过会话：结果属于旧会话，不能写进当前输入框。
          if (sessionAtStart !== sessionIdRef.current) {
            toastFn('error', 'Session changed during enhancement; result discarded')
            return
          }
          if (canApplyResult(value) && typeof inputActions?.setDraft === 'function') {
            try {
              inputActions.setDraft(value.text)
            } catch (error) {
              // 写回阶段失败与「模型没增强出来」是两回事，必须分开报。
              toastFn('error', `write-back failed: ${error?.message ?? String(error)}`.slice(0, 140))
              return
            }
            const scoreText = score === undefined ? '' : ` (${t('score')}: ${score})`
            const notes = assumptions === 0 ? '' : ` - ${assumptions} assumption(s)`
            const warn = violations === 0 ? '' : ` - ${violations} ${t('deviations')}`
            toastFn('success', `${t('applied')}${scoreText}${notes}${warn}`)
            // 已经写回当前会话，清掉暂存，避免切回来时又弹出同一份结果。
            void Promise.resolve(rpc.call('/api', CLEAR_PENDING_ENDPOINT, {
              args: { agentId: sessionId, request: { clientKey: sessionId } },
            })).catch(() => {})
            return
          }
          // 走不到写回（环境没给 setDraft）时，结果留在面板里，别丢。
          setPendingResult(value)
          setOpen(true)
          toastFn('success', `${t('applied')} - ${violations} ${t('deviations')}`)
        } catch (error) {
          toastFn('error', controller.signal.aborted
            ? 'Cancelled'
            : `enhance failed: ${error?.message ?? String(error)}`.slice(0, 140))
        } finally {
          if (abortRef.current === controller) abortRef.current = null
          setBusy(false)
        }
      }, [rpc, sessionId, draft, requestBase, disabled, busy, inputActions, t, toastFn])

      const toastNode = toast === null
        ? null
        : h(Toast, {
          key: toast.seq,
          text: toast.text,
          onDone: () => { if (mountedRef.current) setToast(null) },
        })

      return h('div', { className: 'dsh-pw-root' },
        h('style', null, css),
        toastNode,
        h('button', {
          type: 'button',
          className: busy ? 'dsh-pw-button is-busy' : 'dsh-pw-button',
          'aria-label': t('action'),
          title: busy ? 'Cancel' : title,
          disabled,
          onMouseDown: event => event.preventDefault(),
          // 左键承担全部：单击增强，双击看刚出来的结果 / 调参数。
          // 右键不绑任何动作——原生上下文菜单本来也没用，绑了只是多一个要解释的入口。
          onClick: event => {
            if (event.detail >= 2) {
              setOpen(true)
              return
            }
            runDirect()
          },
          onContextMenu: event => event.preventDefault(),
        }, h(SparkleIcon)),
        open
          ? renderOverlay(h(PanelBoundary, {
            onClose: () => {
              setOpen(false)
              setPendingResult(null)
            },
          },
          h(WeaverPanel, {
            useInput,
            inputActions,
            sessionId,
            rpc,
            t,
            requestBase,
            onClose: () => {
              setOpen(false)
              setPendingResult(null)
            },
            toast: toastFn,
            initialResult: pendingResult,
          })))
          : null
      )
    }

    function inferCommand(draft) {
      const match = /^\/[^\s]+/u.exec(draft)
      return match === null ? undefined : match[0]
    }

    // 两条增强路径共用的写回判定：只判断「这次有没有拿到可用结果」。
    // 违规检测照常算，但不再拦写回——点一次增强就该拿到东西，
    // 模型偶尔漏掉一个保护项不该让整次操作看起来失败；
    // 偏离情况在 toast 与面板里提示，由用户决定要不要退回去。
    function canApplyResult(result) {
      if (result === undefined || result === null) return false
      return typeof result.text === 'string' && result.text.length > 0
    }

    // 前提复核：用户要的那件事本身做不到时，这里是唯一能说出口的位置。
    // 它不改任务范围，只在执行前把「这条路大概率走不通」摆出来。
    function renderPremise(result, t) {
      const check = result.premiseCheck
      if (check === undefined || check === null || typeof check.problem !== 'string') return null
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, t('premiseTitle')),
        h('div', { className: 'dsh-pw-error' }, check.problem),
        check.alternative === '' || check.alternative === undefined
          ? null
          : h('div', { className: 'dsh-pw-muted' }, `${t('premiseAlternative')}: ${check.alternative}`)
      )
    }

    function renderQuality(result, t) {
      const quality = result.quality
      if (quality === undefined) return null
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, t('quality')),
        h('div', { className: 'dsh-pw-muted' },
          `${t('score')}: ${quality.score}; ${t('compare')}: ${result.comparison?.delta?.score ?? 0}`),
        h('ul', null,
          h('li', null, `${t('constraints')}: ${quality.metrics?.constraintCount ?? 0}`),
          h('li', null, `${t('protected')}: ${quality.metrics?.retainedProtectedItemCount ?? 0}/${quality.metrics?.protectedItemCount ?? 0}`)
        ),
        quality.passed ? h('div', { className: 'dsh-pw-ok' }, 'OK') : h('div', { className: 'dsh-pw-error' }, t('failedGate'))
      )
    }

    // assumptions 是模型为了继续下去而自己补的前提。之前只在 toast 里报个数，
    // 用户看不到具体内容，就无法判断这个前提能不能成立。
    // 缺口清单：把「这类任务必须答清、但草稿还没提」的维度按严重度摆出来。
    // 之前只报一个前提条数，用户看不出到底缺什么、哪条最要紧。
    function renderCompleteness(result, t) {
      const report = result.completeness
      if (report === undefined || report === null) return null
      if (!Array.isArray(report.gaps) || report.gaps.length === 0) {
        // 两种情况看着一样、含义完全不同：判定过且没缺口，和根本没有判定规则。
        // 后者说成「没有必须补的缺口」是假阳性，会让用户以为检查过了。
        const unprobed = report.source === 'unprobed'
        return h('div', { className: 'dsh-pw-card' },
          h('strong', null, t('completeness')),
          h('div', { className: unprobed ? 'dsh-pw-muted' : 'dsh-pw-ok' },
            unprobed ? t('unprobed') : t('noGaps'))
        )
      }
      const percent = Math.round((report.coverage ?? 0) * 100)
      const groups = [
        { severity: 'blocking', label: t('mustSpecify'), className: 'dsh-pw-error' },
        { severity: 'important', label: t('shouldSpecify'), className: 'dsh-pw-muted' },
        { severity: 'optional', label: t('couldSpecify'), className: 'dsh-pw-muted' },
      ]
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, `${t('completeness')} · ${t('coverage')} ${percent}%`),
        groups.map(group => {
          const items = report.gaps.filter(gap => gap.severity === group.severity)
          if (items.length === 0) return null
          return h('div', { key: group.severity },
            h('div', { className: group.className }, group.label),
            h('ul', null, items.map(gap => h('li', { key: gap.id },
              Array.isArray(gap.missingSlots) && gap.missingSlots.length > 0
                ? `${gap.question} · ${gap.missingSlots.join(' / ')}`
                : gap.question
            )))
          )
        })
      )
    }

    function renderAssumptions(result, t) {
      const assumptions = result.assumptions
      if (!Array.isArray(assumptions) || assumptions.length === 0) return null
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, t('assumptions')),
        h('ul', null, assumptions.map((item, index) => h('li', { key: index }, String(item))))
      )
    }

    // openQuestions 是 { question, reason } 的对象数组，直接 String() 会得到 [object Object]。
    function openQuestionText(item) {
      if (typeof item === 'string' && item.length > 0) return item
      const question = typeof item?.question === 'string' ? item.question : ''
      if (question.length === 0) return String(item)
      return typeof item?.reason === 'string' && item.reason.length > 0 ? `${question} (${item.reason})` : question
    }

    function renderAnalysis(result, t) {
      const analysis = result.analysis
      if (analysis === undefined) return null
      const constraints = analysis.constraints ?? []
      const openQuestions = result.openQuestions ?? []
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, `${t('framework')}: ${result.framework ?? '-'}; ${t('mode')}: ${result.mode ?? '-'}`),
        // 这里原先拿 constraints.length 顶替「受保护项」的数字，标签与数字对不上：
        // 受保护项的留存率在质量卡里已有口径，这张卡只报约束数与待确认数。
        h('div', { className: 'dsh-pw-muted' }, `${t('constraints')}: ${constraints.length}; ${t('openQuestions')}: ${openQuestions.length}`),
        openQuestions.length === 0
          ? null
          : h('ul', null, openQuestions.map((item, index) => h('li', { key: index }, openQuestionText(item))))
      )
    }

    function renderContext(result, t) {
      const context = result.context
      if (context === undefined) return null
      return h('div', { className: 'dsh-pw-card' },
        h('strong', null, t('context')),
        h('div', { className: 'dsh-pw-muted' },
          `project: ${context.projectAvailable ? 'yes' : 'no'}; conversation: ${context.conversationMessages ?? 0}; redactions: ${context.redactions ?? 0}`)
      )
    }

    // 与 src/core/diff.js 同一套语义：LCS 对齐，超长输入退化为公共前后缀。
    // client bundle 拿不到核心模块，只能内联一份等价实现。
    // 自拼前后缀只能说明「头尾相同」，中间被改动的词一律看不见，这才是要修的地方。
    const DIFF_MAX_TOKENS = 1200

    function diffTokenize(text) {
      return String(text ?? '')
        .split(/(\s+|[^\p{L}\p{N}_]+)/u)
        .filter(token => token.length > 0)
    }

    function diffEscape(text) {
      return String(text ?? '').replace(/\n/gu, '⏎')
    }

    function renderDiff(original, enhanced) {
      const left = diffTokenize(original)
      const right = diffTokenize(enhanced)
      const operations = left.length * right.length > DIFF_MAX_TOKENS * DIFF_MAX_TOKENS
        ? diffByEdges(left, right)
        : diffByTable(left, right)
      const lines = []
      for (const operation of operations) {
        if (operation.type === 'equal') lines.push(`  ${diffEscape(operation.text)}`)
        else if (operation.type === 'delete') lines.push(`- ${diffEscape(operation.text)}`)
        else if (operation.type === 'insert') lines.push(`+ ${diffEscape(operation.text)}`)
        else {
          lines.push(`- ${diffEscape(operation.text)}`)
          lines.push(`+ ${diffEscape(operation.replacement)}`)
        }
      }
      return lines.join('\n')
    }

    function diffByTable(left, right) {
      const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
      for (let i = left.length - 1; i >= 0; i -= 1) {
        for (let j = right.length - 1; j >= 0; j -= 1) {
          table[i][j] = left[i] === right[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1])
        }
      }
      const operations = []
      let i = 0
      let j = 0
      while (i < left.length && j < right.length) {
        if (left[i] === right[j]) {
          pushDiffOperation(operations, 'equal', left[i])
          i += 1
          j += 1
        } else if (table[i + 1][j] >= table[i][j + 1]) {
          pushDiffOperation(operations, 'delete', left[i])
          i += 1
        } else {
          pushDiffOperation(operations, 'insert', right[j])
          j += 1
        }
      }
      while (i < left.length) {
        pushDiffOperation(operations, 'delete', left[i])
        i += 1
      }
      while (j < right.length) {
        pushDiffOperation(operations, 'insert', right[j])
        j += 1
      }
      return mergeDiffOperations(operations)
    }

    function diffByEdges(left, right) {
      const prefix = commonPrefix(left, right)
      const suffix = commonSuffix(left.slice(prefix), right.slice(prefix))
      const operations = []
      for (let index = 0; index < prefix; index += 1) pushDiffOperation(operations, 'equal', left[index])
      for (const token of left.slice(prefix, left.length - suffix)) pushDiffOperation(operations, 'delete', token)
      for (const token of right.slice(prefix, right.length - suffix)) pushDiffOperation(operations, 'insert', token)
      for (const token of left.slice(left.length - suffix)) pushDiffOperation(operations, 'equal', token)
      return mergeDiffOperations(operations)
    }

    function pushDiffOperation(operations, type, text) {
      const previous = operations[operations.length - 1]
      if (previous !== undefined && previous.type === type) {
        previous.text += text
        return
      }
      operations.push({ type, text })
    }

    function mergeDiffOperations(operations) {
      const merged = []
      for (let index = 0; index < operations.length; index += 1) {
        const current = operations[index]
        const next = operations[index + 1]
        if (current.type === 'delete' && next?.type === 'insert') {
          merged.push({ type: 'replace', text: current.text, replacement: next.text })
          index += 1
          continue
        }
        if (current.type === 'insert' && next?.type === 'delete') {
          merged.push({ type: 'replace', text: next.text, replacement: current.text })
          index += 1
          continue
        }
        merged.push({ type: current.type, text: current.text })
      }
      return merged
    }

    function commonPrefix(left, right) {
      let index = 0
      while (index < left.length && index < right.length && left[index] === right[index]) index += 1
      return index
    }

    function commonSuffix(left, right) {
      let index = 0
      while (index < left.length && index < right.length && left[left.length - 1 - index] === right[right.length - 1 - index]) index += 1
      return index
    }

    return {
      inject: ['slots', 'connection', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }))
        const rpc = ctx.connection?.rpc
        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-prompt-weaver',
          order: 15,
          locale: NS,
        }, props => h(WeaverButton, { ...props, rpc })))
      },
    }
  },
})
