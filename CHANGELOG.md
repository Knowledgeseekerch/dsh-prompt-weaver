# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.17] - 2026-11-08

This release changes what the enhancer is able to ask for, not just how it phrases things.

### Added

- A domain library: six task domains (hardware, software, research, writing, operations, planning), each carrying the dimensions an executor has to answer and, under each dimension, the slots that answer must cover. A draft about building a smart car now demands the controller, the motors and their driver, the sensors, and the power supply — instead of asking for "the key parts" and letting the executor stay vague.
- Domain bootstrapping: when a draft matches no built-in domain, the planner asks the model once which dimensions this kind of task cannot be executed without, then folds that list into the enhancement. Coverage is no longer bounded by the hand-written library. The answer is cached per draft, so a repeated run costs one model call, not two.
- `config.autoDomains` (default on) turns bootstrapping off when the extra call is not wanted.

### Changed

- The enhancer may now require the executor to answer a dimension the draft left implicit — but only as something to specify ("state which controller you chose and why"), never as a decision already made ("use an STM32F103"). A planned dimension that names a product, model number, price, or vendor is dropped before it reaches the prompt, because pinning a guess into the prompt is worse than leaving the gap.
- Every stage the enhancer writes must carry an observable pass condition: a number, a signal, or a visible state. "Stable", "fast", and "works well" are no longer accepted as one.

## [0.2.16] - 2026-11-08

### Changed

- A quality violation no longer withholds the enhanced text. The engine rejected the whole run in `strict` mode, and the client skipped write-back in every mode, whenever a protected-item, constraint, language, or reference check failed. Both now deliver the text and report the deviation count instead. A run that produced usable text should not look like a failure because one heuristic threshold tripped.

### Fixed

- The deviation count in the one-click toast is localised instead of appending an English `deviation(s)` to an already-translated sentence.

## [0.2.15] - 2026-11-08

### Fixed

- The result panel wrote the enhanced text into the draft even when the result carried violations, so reaching the same result through the panel bypassed the quality gate the one-click path already enforced. Both paths now share one `canApplyResult` predicate, and a gated result stays in the panel for the user to apply by hand.
- `'.ps1'` was listed as `'ps1'` in the text-extension set, so PowerShell scripts were never indexed as context. `.psm1` and `.psd1` are recognised as well.
- `scoreFile` compared raw paths against `/src/` prefixes, which never matched on Windows; backslashes are normalised before scoring.
- The analysis card reported `constraints.length` under the protected-items label, so the number and the caption described different things. The card now reports the constraint count and renders each open question instead of a bare count.
- `renderQuality` guarded a row with `length >= 0`, a condition that is always true.
- An explicit `locale` was ignored whenever the draft language was detected as `zh` or `en`; the request now wins, with the draft language as the fallback.
- The configuration-import size limit counted UTF-16 code units while its message promised bytes; it now measures UTF-8 bytes.

## [0.2.14] - 2026-11-08

### Added

- The result panel can copy the enhanced prompt to the clipboard, so a result meant to be pasted somewhere else no longer needs a manual select-all.
- The panel now lists the assumptions the model filled in, one per line. The toast used to report only a count, which left no way to judge whether a filled-in gap actually held.
- The comparison view aligns both sides with a longest-common-subsequence diff instead of trimming a shared prefix and suffix, so an edit in the middle of a prompt is visible. Inputs past roughly 1200 tokens a side fall back to the prefix/suffix view rather than allocating the full table.

### Fixed

- `sessionIdRef` was declared in the panel but read in the button, so every one-click run threw as soon as write-back started. It is now declared where it is read.

## [0.2.13] - 2026-11-08

### Fixed

- Every internal failure of the one-click path was reported as "the model could not enhance this prompt", including failures during write-back that happen after a successful enhancement. Write-back now has its own guard and its own message.

### Changed

- A failing run now names the stage: `[reason] …` for a business rejection, `rpc failed (…)` for a transport error, `write-back failed: …` when the result could not be applied, and `enhance failed: …` for anything else.

## [0.2.12] - 2026-11-08

### Fixed

- `takePending` and `clearPending` were declared in the descriptor as `(agent, request)` but implemented as `(request)`, so the argument the host bound to `agent` was read as the request and the client key never arrived. A registry that validates the declared shape could also reject the plugin outright, which is consistent with enhance failing entirely. The signatures now match the declaration and still tolerate a single-argument call.
- A failed one-click run reported only the generic message when the rpc layer rejected without a business error object; it now names the rejection shape (`rpc failed (TypeError: …)`).

## [0.2.11] - 2026-11-08

### Fixed

- `request.clientKey` is now part of the accepted request shape. The service strips it before the engine runs, but a host still on an older build rejected the whole request with `invalid-config: request has unknown key(s): clientKey` as soon as the newer client sent it. Tolerating the key makes a client/host version mismatch fail softly instead of breaking every enhancement.

## [0.2.10] - 2026-11-08

### Fixed

- A failed one-click run showed only "the model could not enhance this draft" even when the request never reached the host, because the rpc rejection was swallowed. The rejection message is now surfaced, so the toast says what actually failed.

### Changed

- Minor indentation cleanup in the client endpoint constants.

## [0.2.9] - 2026-11-08

### Added

- Enhancement results survive a session switch. The host keeps the last eight results keyed by the client's session key for ten minutes; when a composer mounts and finds a stored result it opens the panel with it, so leaving a session mid-request no longer throws the work away.
- `promptWeaver/takePending` and `promptWeaver/clearPending` expose that store. A successful write-back clears its own entry, so returning to the session does not reopen the same result.
- `tests/pending-results.test.js`: take-once semantics, per-session keys, clear, and the no-key case.

### Changed

- The desktop button no longer blocks on the assumption count alone (0.2.7) and, from this release, a result produced while the composer was unmounted is kept rather than discarded.

## [0.2.8] - 2026-11-08

### Fixed

- Switching sessions while an enhancement was running could write the result into the newly focused session's composer, or lose it silently when the old composer unmounted. The request now records the originating session and discards the result if the session changed, with a toast explaining why.
- The busy state and abort handle are reset when the session changes, so the button no longer stays in its loading state after a switch.

### Known limitation

- Two sessions cannot enhance at the same time: the button lives inside a per-session composer, so leaving a session unmounts it and the in-flight result has nowhere to go. Results are not persisted host-side yet.

## [0.2.7] - 2026-11-08

### Fixed

- The write-back guard treated an assumption as a blocker, so any draft the model had to make an assumption about (for example "打开抖音并点赞") opened the panel instead of applying. Only violations block now; assumptions are reported in the toast.
- The panel rendered the result twice: an editable textarea plus a read-only `pre` with the same text. The `pre` is only used for the diff view now.

## [0.2.6] - 2026-11-08

### Added

- The one-click enhance can be cancelled: pressing the button again while a request is in flight aborts it through the same AbortSignal the provider already honours. Previously the only way out was to wait for three retries plus the timeout.

### Changed

- The composer button stays clickable while busy and its tooltip switches to Cancel, instead of being disabled with no way out.

## [0.2.5] - 2026-11-08

### Changed

- The shipped defaults now match what 0.2.0 announced: `context.maxFiles` 2, `context.maxTotalBytes` 16384, `maxConversationMessages` 4, `maxConversationChars` 2000. Previously only the local profile config was narrowed, so fresh installs kept the old 10/12/8000 values.
- README states the current test count and install tag, and describes assumption handling as it actually behaves (`standard` returns them, `strict` rejects them).

### Added

- `schemas/config.schema.json` gains `maxOutputTokensCap` and `reasoningEffort`, so the schema covers every field `readConfig()` accepts.

## [0.2.4] - 2026-11-08

### Fixed

- Concurrent enhance requests could read each other's session: `service.currentAgent` was a shared mutable field. Requests now run inside an `AsyncLocalStorage` scope, so the provider and context collector always see the session that belongs to the call.
- One-click enhance overwrote the composer even when the result carried violations or assumptions. It now writes back only when both are empty; otherwise the panel opens with the result and the user decides.
- `llm.stream` was sent `purpose: 'prompt-weaver'`, which is outside the documented `'compaction' | 'session-title'` union. The field is no longer sent.
- An unknown `request.taskType` silently degraded to the `general` framework; it now raises `invalid-value` and lists the valid values.
- `privacy.redactSecrets: false` had no effect because file redaction ran unconditionally; the switch is honoured now.
- Oversized files were read in full before the size check. When `fs.stat` is available the file is skipped before reading, with the previous behaviour kept as a fallback.

### Changed

- 36 stray `.bak` copies were removed from the repository. `scripts/check.mjs` now fails when a backup file appears, and `package.json` excludes `**/*.bak*` from the published package.

### Added

- `tests/request-scope.test.js`: concurrent scope isolation, nested scopes, and leakage checks.

## [0.2.3] - 2026-11-08

### Fixed

- Noise drafts such as `。`, `🤔` or `算了` were rewritten into a full task out of nothing; they are now rejected with `too-vague` instead of inventing intent.
- `帮我写个 C++ 控制舵机的程序` was classified as writing because `writing` matched the bare character 写; the keyword list no longer contains it.
- `docs` matched 注释, so code that merely asked for comments fell into the docs task type; that keyword is gone.
- `code` had no entry for C++ / C# / Java / Rust / Go / SQL nor for 程序 / 编程, so programming requests landed in `general`.

### Added

- `tests/fixtures/testset.jsonl`: 49-case evaluation corpus (L0–L5 gradient, adversarial set, controlled same-intent set) kept in the repo for future regression work.

## [0.2.2] - 2026-11-08

### Changed

- `timeoutMs` now bounds the whole enhancement instead of each attempt: retries share one deadline, so a 30-second setting can no longer take 90 seconds.
- The output budget cap is configurable through `maxOutputTokensCap` (default 16000), so users on models with a smaller output limit can tighten it.

### Fixed

- A stream that ignores the abort signal could hang the request forever; the reader now races `iterator.next()` against an abort promise so cancellation returns immediately, and releases the iterator through `return()` when possible.

### Added

- `tests/provider-timeout.test.js`: cap enforcement, cancellation of a hanging stream, and shared-deadline behaviour. Suite is now 79 cases.

## [0.2.1] - 2026-11-08

### Fixed

- Retry loop reported "even at 16000 tokens" without ever using that budget; it now doubles until `MAX_OUTPUT_TOKENS` is genuinely reached, and reports the real value.
- A cancelled request could still start the next retry round: `assertAbort` now runs before and after every attempt.
- English markers matched inside longer words (`import` in important, `who` in Wholesale, `fix` in prefix); they now require word boundaries.
- `BUILD_MARKERS` treated nouns such as 页面 / 接口 / 模型 / 代码 as build requests, so genuine operations fell through to general or code; it now keeps verbs only.
- Operation classification now takes precedence over question, so 如何打开抖音并点赞 is treated as an operation.

### Added

- `tests/classification.test.js` and `tests/provider-retry.test.js`. Suite grew from 52 to 75 cases covering retry budgets, cancellation semantics and classifier edge cases.

## [0.2.0] - 2026-11-08

### Added

- `question` task type: a draft that is a single question is sharpened into a sharper question instead of being expanded into a task plan. The framework has one section, so a counter-question list cannot be produced structurally.
- `automation` task type: operation requests such as "open X and like Y" expand into approach / steps / success check / failure handling, and are no longer captured by the `engineering` framework.
- `reasoningEffort` config field, forwarded to `llm.stream` when set.
- Failure messages now carry their reason code, shown as `[reason] message`.

### Changed

- The quality gate no longer discards the whole result in `standard`/`minimal` mode; violations are returned with the result. `strict` keeps the one-vote veto.
- Output token budget is adaptive: `max(configured, draftChars * 2 + 2000)`, capped at 16000, and doubled when the model reports `max-tokens`.
- The composer button enhances in one click without opening the panel; right-click still opens the full panel.
- Prompt rules now distinguish sharpening (allowed) from scope expansion (forbidden), with the test "could the user still say that is exactly what I asked for?".
- At most three open questions, and a counter-question may not replace an answer.
- Default context and history budgets narrowed to 2 files / 16384 bytes and 4 messages / 2000 chars.

### Fixed

- Normal completion was treated as a failure: DSH reports `reason.kind = "stop"`, not `"completed"`.
- The panel was nearly unreadable because three theme tokens do not exist in the DSH theme (`--dsw-alias-bg-primary`, `--dsw-alias-bg-secondary`, `--dsw-alias-border-primary`).
- The length gate rejected short drafts: `original * 6` allowed only 42 characters for a 7-character draft.
- Parsing aborted the run when the model wrapped JSON in prose, added an unknown field, or returned more items than the limit.
- The original draft pane followed the live composer, so diff comparison became useless after auto-write-back.
- The enhanced text could include the original draft, a `---` separator, and an "optimized prompt" label.

## [0.1.1] - 2026-11-08

### Fixed

- The composer panel was nearly unreadable because three theme tokens it referenced do not exist in the DSH theme: `--dsw-alias-bg-primary`, `--dsw-alias-bg-secondary`, and `--dsw-alias-border-primary`. `var()` failed and the whole `background` declaration was dropped, leaving the panel transparent. Replaced with `--dsw-alias-bg-base` / `--dsw-alias-bg-layer-2`, `--dsw-alias-bg-layer-1`, and `--dsw-alias-border-l2`; the overlay also moved from 55% to 72% with a light backdrop blur.

### Changed

- The enhanced text is now written straight back into the composer when a run succeeds, so the extra "Apply" click is gone. The panel stays open for diff, quality and context review. "Undo" writes back to the composer as well, keeping panel and composer in sync.

## [0.1.0] - 2026-11-08

### Added

- Framework-aware prompt enhancement engine with task-type recognition, constraint extraction, ambiguity heuristics, and structured model output.
- Original-intent quality gate for protected slash commands, file references, code spans, URLs, versions, explicit constraints, and draft language.
- Mixed-draft support for `/command + text`, file mentions, structured composer occurrences, and attachment-preserving enhancement.
- Built-in frameworks for general, concise, engineering, debugging, review, testing, research, and writing tasks.
- Custom framework registration, import/export, conflict policies, validation, and optional persistence.
- Bounded project context collection with sensitive-file skipping and secret redaction.
- DSH Host service with `enhance`, `listFrameworks`, `importConfig`, and `exportConfig` Remote endpoints.
- Web composer panel with preview, quality checks, comparison, unified diff, bounded iteration, feedback, import/export, and explicit draft replacement.
- Zero-dependency offline CLI with local deterministic enhancement, framework/config management, context files, and comparison.
- Configuration schemas, examples, architecture/security/configuration/compatibility/release documentation.
- 52 automated Node built-in tests, syntax/JSON checks, lightweight lint, CI workflow, and GitHub release workflow.

### Known limitations

- No live DSH release has been smoke-tested yet; see `docs/compatibility.md`.
- Quality scores are deterministic preservation/structure heuristics, not a guarantee of model quality.
- Attachments are preserved but their bytes are not read or enhanced.
- The CLI uses the deterministic local provider; model-backed enhancement is available through the DSH Host service.
