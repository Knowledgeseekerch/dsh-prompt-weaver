# Security and privacy

## Data sent to the model

With default settings, an enhancement request may include:

- the user's draft;
- protected-item metadata (slash command, structured occurrences, attachment count);
- deterministic analysis metadata;
- selected framework guidance;
- bounded project file excerpts, a compact tree, and recent user messages, if Host filesystem services are available.

It does not include:

- attachment bytes;
- model credentials;
- the full project tree unless configured;
- assistant messages, unless `includeAssistantMessages: true`;
- synthetic plugin/skill messages injected as user events.

## Sensitive files and secrets

The context collector skips filenames and extensions commonly associated with secrets, including `.env`, private keys, certificates, and credential files. It also skips binary content and files larger than `context.maxIndexedFileBytes`.

Before context leaves the Host, credential-like strings are replaced with placeholders such as `[REDACTED:credential-assignment:1]`. The detector reports offsets and kinds but never returns secret values to the UI.

By default, a draft containing high-confidence secrets or private-key markers is rejected with `sensitive-draft`. This is deliberately conservative. If the user disables `privacy.blockSensitiveDraft`, the draft is passed to the selected model provider as-is.

## Session safety

The Host service:

- does not append to the session log;
- does not call agent tools;
- does not submit or send messages;
- does not modify project files;
- does not install or download anything.

The Web control only calls the Host through the declared RPC endpoints and replaces the draft after the user explicitly applies a result. If the composer draft changed during a request, the result is discarded instead of overwriting the newer draft.

## Prompt injection boundaries

Project files and conversation text are explicitly marked as untrusted reference data in the model prompt. The model is instructed not to follow instructions found inside them. Local analysis remains deterministic, so a file cannot change plugin configuration, context budgets, or quality gates.

## Import/export boundaries

Configuration bundles contain only:

- safe preferences such as mode, default framework, and iteration limit;
- custom framework definitions.

They do not contain prompts, drafts, enhancement history, project excerpts, model routes, or credentials. Imported frameworks are schema-validated, bounded, and conflict-checked.

## Threat model notes

- DSH plugins run with Host process permissions. Review the source before installing any third-party bundle, including this one.
- Bounded sampling reduces accidental over-sharing but does not make project content non-sensitive. Users should still confirm that selected files are safe to send to their provider.
- Secret detection is heuristic and cannot guarantee detection of every secret format. Treat `redactSecrets` as defense in depth, not authorization to include credentials.
- This plugin intentionally has no telemetry.
