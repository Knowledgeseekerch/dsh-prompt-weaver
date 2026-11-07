# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
