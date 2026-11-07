# Architecture

`dsh-prompt-weaver` is split into four layers so the prompt engine can evolve independently from DSH-specific integration code.

## 1. Core engine (`src/core/`)

The core is dependency-free ESM JavaScript and is directly reusable by the CLI and tests.

| Module | Responsibility |
|---|---|
| `draft.js` | Parses mixed drafts and finds slash commands, structured occurrences, file mentions, code spans, URLs, and versions. |
| `analyze.js` | Detects language, task type, explicit constraints, and ambiguity heuristics without inventing answers. |
| `frameworks.js` | Validates, stores, selects, imports, exports, and optionally persists framework definitions. |
| `context.js` | Collects bounded project and conversation context through injected Host services. |
| `privacy.js` | Detects and redacts high-confidence secrets; reports offsets without echoing secret values. |
| `prompt.js` | Builds system instructions and a JSON user payload with untrusted-reference boundaries. |
| `structured.js` | Parses the model's JSON output and validates its shape. |
| `quality.js` | Applies the original-intent gate and computes heuristic structure/preservation metrics. |
| `engine.js` | Orchestrates validation, analysis, context, model call, output gate, comparison, and result shape. |
| `local-provider.js` | Deterministic offline provider used by the CLI and tests. |
| `provider.js` | DSH `ctx.llm.stream` adapter and static test provider. |

The engine does not import DSH packages. It consumes injected adapters, which keeps it testable and makes Host changes localized.

## 2. Host plugin (`index.js`, `src/host/`)

The Host registers a `promptWeaver` service and four Typert Remote invocations:

- `enhance`
- `listFrameworks`
- `importConfig`
- `exportConfig`

It follows the DSH Host pattern: `ctx.provide(...)` for the service, `ctx.inject(['typert'], ...)` for Remote registration, and `ctx.get(...)` for optional seams such as `fs`, `workingDirectory`, and `agentDefaultModel`. Model routing uses, in order:

1. explicit `provider` + `model` config;
2. the current session request header;
3. `agentDefaultModel.currentSelection()`.

If no route exists, enhancement fails with `no-route` rather than silently choosing a different model.

The plugin does not modify the agent loop and does not register model tools or hooks. It is a Host service consumed by the Web composer control.

## 3. Web client (`client.js`)

The Web half registers a button in `conversation.input.right`. The panel reads composer state through the session slot kit:

- `draft`
- `phase`
- `occurrences`
- `attachmentIds`
- `inputActions.setDraft`

It sends protected-item metadata (`command`, `occurrences`, `attachmentCount`) to the Host. Applying a result only replaces the draft text; attachments are not cleared and nothing is submitted. The panel keeps its mode, current result, feedback, and small undo stack in React state only.

## 4. CLI (`bin/dsh-prompt-weaver.js`)

The CLI reuses the same core engine with a deterministic local provider. It supports explicit user-provided JSON context, framework validation/import/export, configuration import/export, and prompt comparison. It does not discover files implicitly or call a model.

## Data flow

```text
Composer draft + command/occurrence/attachment metadata
  -> Host Remote enhance(agentId, request, signal)
  -> mixed-draft parsing
  -> analysis and framework selection
  -> bounded context collection and redaction
  -> model provider (DSH llm or local)
  -> strict JSON output parsing
  -> original-intent quality gate
  -> result: text, open questions, quality, comparison, context summary
  -> user edits and applies draft
```

## Error model

Operational failures are normalized into machine-readable reasons such as:

- `empty`, `too-long`, `command-only`, `sensitive-draft`;
- `unavailable`, `no-route`, `timeout`, `aborted`;
- `model-failed`, `model-output-invalid`, `model-output-too-long`;
- `unverified-assumption`, `fidelity-check-failed`;
- `invalid-config`, `invalid-framework`, `framework-conflict`.

The Web client displays the Host-provided message and never silently overwrites a changed draft.
