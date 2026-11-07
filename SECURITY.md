# Security Policy

## Supported versions

| Version | Status |
|---|---|
| 0.1.x | Active development |

## Reporting a vulnerability

Please do not report exploitable vulnerabilities through public GitHub issues.

Use GitHub's private security reporting when available, or contact the repository maintainer directly. Include:

1. affected version or commit;
2. reproduction steps;
3. whether a live DSH instance is required;
4. data involved (for example, prompt text, project files, credentials, or RPC payload);
5. expected vs. actual behavior;
6. suggested mitigation, if any.

Please allow time for review before public disclosure.

## Scope

In scope:

- secret leakage to logs, exports, or model providers;
- unsafe path traversal or file reads in context collection;
- prototype pollution or unsafe object handling in imported JSON;
- RPC/config/framework validation bypasses;
- unauthorized draft replacement or message submission;
- dependency vulnerabilities, if dependencies are ever introduced.

Out of scope:

- general bugs in DeepSeek Harness itself;
- model provider behavior outside this plugin's request;
- quality of model output that does not violate security or privacy guarantees;
- issues requiring attacker control of the local DSH Host process outside documented plugin trust boundaries.

## Security expectations

The plugin should never:

- send a message automatically;
- write to the session log;
- modify project files;
- persist prompt text, project excerpts, or enhancement history;
- include model credentials in exports;
- execute instructions embedded in project files or conversation content.

Context is bounded and redacted by default, and sensitive drafts are blocked unless the user explicitly changes `privacy.blockSensitiveDraft`.
