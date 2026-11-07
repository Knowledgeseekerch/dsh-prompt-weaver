# Compatibility

## Target

This plugin targets the **DeepSeek Harness developer-preview Web profile** and the DSH bundle/Typert Remote model used by current community Host + Web composer plugins. It is not a model provider and does not depend on the concrete agent loop implementation.

No exact DSH release has been certified yet. Treat the first live-install smoke test as the compatibility gate.

## Verified against

The implementation was checked against public source and API shapes:

- **Official DSH `master` Web input contract** at commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`:
  - composer input exposes `draft`, `phase`, `occurrences`, `attachmentIds`;
  - `inputActions.setDraft` replaces draft text without submitting;
  - structured references are ordered, non-overlapping spans with `clipboardText`.
- **Existing `dsh-prompt-enhance` public bundle pattern** at commit `b7c259ba0528a27b1460973638651a4d023958d4`:
  - Host service via `ctx.provide(...)`;
  - Typert Remote descriptor via `ctx.inject(['typert'], ...)`;
  - Web control in `conversation.input.right`;
  - model access through `ctx.llm.stream(...)`.

The automated Host test uses in-memory service doubles for these seams and validates the descriptor shape, model routing, context collection, and enhancement flow without requiring a live DSH process or API key.

## Expected compatibility

| Component | Status |
|---|---|
| DSH Web profile / composer slots | Designed and mock-tested; live install pending |
| Host Typert Remote `enhance` RPC | Designed and mock-tested; live RPC pending |
| `ctx.llm.stream` model seam | Designed and mock-tested; live provider pending |
| `ctx.fs` / `workingDirectory` / `agentDefaultModel` | Designed and mock-tested; live Host pending |
| Headless / SDK / ACP profiles | Not targeted by the composer control |
| DSH versions before the current Typert/bundle model | Not supported |

## Live smoke-test checklist

Run this before publishing a compatibility claim for a specific DSH release:

1. Start or install DSH and note the exact version and commit.
2. Install the cloned bundle through the plugin manager, not by editing profile files manually.
3. Refresh the Web client and confirm the sparkle button appears in the composer tool row.
4. Enhance a plain draft, a `/command + text` draft, a draft with `@file`, and a draft with an attachment.
5. Confirm the slash command and file references remain, attachments are not cleared, and no message is sent automatically.
6. Inspect Host logs/RPC for a `promptWeaver/enhance` failure if the button does not work.
7. Verify `listFrameworks`, `importConfig`, and `exportConfig` from the panel.
8. Record the DSH version and update this document only after all checks pass.

## Compatibility maintenance model

Compatibility is not maintained by editing the core engine after every DSH change. It uses three layers:

1. **Automatic probes.** The Web control reads only documented composer state and degrades with a visible message if a required capability is absent. The Host treats optional seams such as `fs` as unavailable rather than crashing.
2. **Adapter isolation.** DSH-specific assumptions stay in `src/host/` and `client.js`. Future DSH API changes should be fixed by adding or updating an adapter there, leaving `src/core/` unchanged.
3. **User feedback window.** Users report their exact DSH version and observed behavior through the compatibility report template. Advanced users may fork and test an adapter change, but normal users are not expected to edit internals.

A future safe extension point may allow maintainers to select named compatibility profiles in configuration. Do not expose raw DSH internals as user-editable configuration; that makes support and security review harder.

## Upgrade policy

Because DSH is in developer preview, minor or patch releases may change plugin APIs. The plugin keeps DSH-specific code in `index.js`, `src/host/`, and `client.js`; the core engine should remain reusable if a future adapter layer is needed. Do not upgrade the compatibility section based on source inspection alone; use the live checklist.
