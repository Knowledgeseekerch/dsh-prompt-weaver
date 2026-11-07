# Contributing

Thanks for helping improve `dsh-prompt-weaver`. This project prioritizes correctness of prompt preservation, predictable failure modes, and privacy.

## Development setup

Requirements:

- Node.js `>=22.19.0`
- Git

No runtime dependency installation is required.

```bash
npm run check
npm run lint
npm test
```

## Before opening a pull request

Run:

```bash
npm run check
npm run lint
npm test
npm run cli:smoke
npm run frameworks:validate
npm run pack:dry-run
```

For a behavior change that affects DSH integration, describe the exact DSH version and whether you ran the live checklist in `docs/compatibility.md`.

## Code guidelines

- Keep the core engine independent of DSH and browser APIs.
- Do not add runtime dependencies without a strong justification and an explicit security review.
- Validate all external input: RPC payloads, config files, framework files, and explicit CLI context files.
- Fail loudly on invalid configuration and unsafe drafts instead of silently degrading.
- Preserve user intent: never add unrequested requirements, facts, files, commands, URLs, or acceptance criteria.
- Return machine-readable failure reasons and human-readable messages.
- Avoid logging prompt text, project excerpts, secrets, or context content.
- Keep tests deterministic; do not require network access or API keys.

## Tests

Use Node's built-in test runner. Add focused tests for:

- mixed slash-command/file/URL/version parsing;
- protected-item and constraint preservation;
- language preservation;
- framework import/export conflicts;
- privacy redaction and sensitive-draft rejection;
- Host service and Typert descriptor shape;
- CLI behavior and failure paths.

## Documentation

Update the relevant document when behavior changes:

- `README.md` for user-facing behavior;
- `docs/architecture.md` for module responsibilities and data flow;
- `docs/configuration.md` and schemas for config changes;
- `docs/security-and-privacy.md` for data-flow changes;
- `docs/compatibility.md` for DSH API assumptions;
- `CHANGELOG.md` for every release-affecting change.

## Reporting security issues

Do not open a public issue for an exploitable vulnerability. See `SECURITY.md`.
