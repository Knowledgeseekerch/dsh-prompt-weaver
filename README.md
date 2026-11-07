# dsh-prompt-weaver

A framework-aware prompt enhancement plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It rewrites a composer draft into a clearer, executable prompt while checking that slash commands, file references, URLs, versions, constraints, and the draft language are preserved.

It is designed to work as a DSH Web bundle and as a zero-dependency offline CLI. The plugin is independent software and is not affiliated with DeepSeek, Claude, or WorkBuddy.

## Highlights

- **Mixed drafts are supported.** `/command`, `@file`, `src/app.ts`, URLs, and versions are detected as protected items. Only a bare slash command is rejected.
- **Original-intent gate.** The engine rejects an enhanced prompt if it loses a protected item, an original constraint, or the draft language.
- **No unverified assumptions.** Model output that declares assumptions is rejected instead of silently replacing the draft.
- **Framework library.** Built-in general, concise, engineering, debugging, review, testing, research, and writing frameworks; custom frameworks can be imported, exported, and selected.
- **Context awareness with budgets.** The Host can sample project files and recent user messages under strict byte, file, depth, and message limits.
- **Privacy by default.** Secrets are redacted in context, high-confidence secrets in drafts block enhancement, assistant messages are excluded unless explicitly enabled, and nothing is auto-sent or persisted by the plugin.
- **Quality reporting.** Deterministic heuristic scores and before/after comparison metrics are exposed to the UI. They measure preservation and structure, not a promise of model performance.
- **Iteration and comparison.** Feedback becomes a constraint for the next round; the panel keeps a small in-memory undo stack and can show a unified diff.
- **Zero runtime dependencies.** The Host, Web client, core engine, and CLI run without installing third-party packages.

## Improvements over the original bundle

Compared with the public `dsh-prompt-enhance` bundle used as a compatibility reference, this project adds:

- **Mixed-draft handling.** Slash commands are no longer a blanket rejection. They are preserved as protected items, and attachments are counted/preserved instead of blocking enhancement.
- **A customizable framework system**, including validation, conflict policies, import/export, optional persistence, and task-type selection.
- **An original-intent gate**, including protected-item, constraint, language, invented-reference, and length checks before a draft is replaced.
- **Explicit assumption rejection** rather than silently accepting inferred requirements.
- **Deterministic quality metrics**, before/after comparison, diff summary, and bounded multi-round feedback.
- **More explicit privacy controls**, including sensitive-draft blocking, context redaction, metadata-only results, and no enhancement-history persistence.
- **A zero-dependency CLI** for offline enhancement, comparison, framework/config management, and reproducible test workflows.
- **Publishable project hygiene**: schemas, examples, compatibility documentation, security policy, CI, release workflow, and 52 automated tests.

This is not a claim that one model or prompt style is universally superior. The plugin's quality metrics measure preservation and structure; actual enhancement quality still depends on the selected model and context.

## Status

- Core engine, Host service, Web composer control, CLI, examples, and 52 automated tests are included.
- The original-intent gate, mixed-draft parser, framework store, config import/export, privacy handling, context collector, and Host/LLM integration are covered by tests.
- Compatibility was implemented against the public plugin API shape used by existing DSH bundles and the official Web input contract (`draft`, `phase`, `occurrences`, `attachmentIds`). It has **not** yet been smoke-tested against a live DSH release; see [docs/compatibility.md](docs/compatibility.md).

## Requirements

- Node.js `>=22.19.0`
- DeepSeek Harness with a Web profile for the composer plugin
- A configured model route for model-backed enhancement

The CLI does not call a model; it uses a deterministic local provider and never scans the filesystem implicitly.

## Install into DSH

Clone the repository, then install the bundle through DSH's plugin manager rather than editing profile files by hand:

```bash
git clone https://github.com/knowledgeseekerch/dsh-prompt-weaver.git
cd dsh-prompt-weaver
npm run check
npm test
```

In DSH Web, use `install_bundle` with the absolute path of the cloned directory. For repeatable installs, pin a commit:

```bash
dsh plugin --profile web add github:knowledgeseekerch/dsh-prompt-weaver#v0.1.0
```

Refresh the Web client. The sparkle button appears in the composer tool row. It does not send messages, listen for keystrokes, or modify project files.

## Use in the composer

1. Enter a normal prompt, a slash command with arguments, a file reference, or any mix of them.
2. Open Prompt Weaver.
3. Choose a mode and framework.
4. Enhance, inspect open questions and quality metrics, edit if needed, then replace the draft.
5. Send the draft yourself.

Example mixed draft:

```text
/prompt 请阅读 @src/app.ts 和 https://example.com/spec ，在 Node.js 22.19 下修复登录问题。不要引入新的依赖，只能修改 src/login.ts。
```

Prompt Weaver preserves the slash command, file reference, URL, version, and constraints. Attachments remain attached, but their bytes are not read by the enhancement request.

## Use the CLI

```bash
# Deterministic offline enhancement
node bin/dsh-prompt-weaver.js enhance --input examples/input/basic.txt

# With an explicit, user-provided JSON context
node bin/dsh-prompt-weaver.js enhance \
  --input examples/input/mixed.txt \
  --context examples/context/workspace.json \
  --json

# Framework management
node bin/dsh-prompt-weaver.js frameworks validate examples/frameworks
node bin/dsh-prompt-weaver.js frameworks export --frameworks examples/frameworks/store.json

# Configuration import/export and prompt comparison
node bin/dsh-prompt-weaver.js config export --config examples/config/dsh-prompt-weaver.config.json
node bin/dsh-prompt-weaver.js compare examples/input/basic.txt examples/input/basic.txt
```

The CLI reports failures without echoing detected secrets. It writes files only when `--output`, an import, or an export is requested.

## Configuration

Host configuration lives in the bundle's `cordis.patch.yml`. All fields are validated; unknown fields fail loudly. Key defaults:

| Setting | Default | Purpose |
|---|---:|---|
| `mode` | `standard` | `minimal`, `standard`, or `strict` |
| `defaultFramework` | `auto` | `auto` or a framework ID |
| `maxDraftChars` | `20000` | Draft length limit |
| `maxResultChars` | `40000` | Enhanced result limit |
| `timeoutMs` | `45000` | Model request timeout |
| `maxIterations` | `5` | Iteration rounds per enhancement |
| `includeAssistantMessages` | `false` | Include assistant replies in conversation context |
| `context.maxFiles` | `10` | Maximum project files sampled |
| `context.maxTotalBytes` | `98304` | Total file/tree/conversation budget |
| `privacy.redactSecrets` | `true` | Redact secrets before context leaves the Host |
| `privacy.blockSensitiveDraft` | `true` | Reject drafts containing high-confidence credentials |
| `persistFrameworks` | `false` | Persist imported frameworks to `frameworksFile` |

See [docs/configuration.md](docs/configuration.md) and [schemas/config.schema.json](schemas/config.schema.json).

## Security and privacy

- The plugin never writes to the session log, submits a message, or modifies project files.
- Project indexing is bounded and skips common dependency/build/cache directories, binary content, and sensitive filenames such as `.env`, private keys, certificates, and credential files.
- Context is redacted before it is passed to the model provider.
- Drafts with high-confidence secrets are blocked by default; turn off `privacy.blockSensitiveDraft` only if you understand the provider will receive them.
- Export bundles contain preferences and custom frameworks only. They do not contain drafts, project content, session history, model credentials, or provider routes.
- The plugin stores no enhancement history. The Web panel keeps a small undo stack in component memory only.

Read [docs/security-and-privacy.md](docs/security-and-privacy.md) before changing context limits.

## Development

```bash
npm run check
npm run lint
npm test
npm run test:coverage
npm run cli:smoke
npm run frameworks:validate
npm run pack:dry-run
```

Tests use Node's built-in test runner. The Host integration test uses in-memory service doubles for `ctx.llm`, `ctx.fs`, `workingDirectory`, `agentDefaultModel`, and `typert`, so no API key is needed.

## Project layout

```text
.
├── index.js                 DSH Host plugin entry
├── client.js                Web composer control
├── src/core/                Engine, frameworks, analysis, quality, privacy, context, providers
├── src/host/                Host service and Typert descriptor
├── bin/                     Offline CLI
├── schemas/                 JSON schemas
├── examples/                Configs, frameworks, mixed inputs, explicit context
├── tests/                   Node built-in test suite
└── docs/                    Architecture, compatibility, privacy, configuration, release
```

## License

Apache-2.0. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
