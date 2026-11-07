# Roadmap

## Near-term

1. **Live compatibility matrix.** Run the checklist in `docs/compatibility.md` on concrete DSH versions and publish supported ranges only after live evidence.
2. **Attachment-aware enhancement.** Once a stable public Host API for reading unsent attachments is confirmed, add opt-in text/code attachment extraction with strict size, type, redaction, and user-visible consent.
3. **Richer context ranking.** Add language-aware file ranking and repository-map summaries without increasing default budgets.
4. **Model-independent evaluation harness.** Add golden fixtures and an evaluation report that checks preservation, structure, and failure behavior across local and model providers.
5. **Compatibility profiles.** Introduce named, maintainer-reviewed Web/Host adapter profiles instead of raw user-editable internals.

## Medium-term

1. **Framework inheritance and composition.** Allow a custom framework to extend a built-in while preserving immutability and schema validation.
2. **Project-specific frameworks.** Load a bounded, explicit framework file from the workspace, with user confirmation and safe-path checks.
3. **Provider adapters.** Add optional adapters for local OpenAI-compatible endpoints behind explicit configuration, without bundling credentials or telemetry.
4. **Interactive open questions.** Let the UI collect answers to Host-returned open questions and feed them back as explicit constraints.
5. **Quality report export.** Export only deterministic metrics and violation metadata, never draft content, for team review.

## Non-goals

- Auto-submitting prompts or driving the agent loop.
- Reading attachment bytes before a stable, consented Host API exists.
- Persisting prompt text, project excerpts, enhancement history, or model credentials.
- Making unverifiable claims that one enhancement style is universally better.
- Adding telemetry or third-party runtime dependencies by default.
