# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
