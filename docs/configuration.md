# Configuration

The Host reads strict configuration from the bundle's `cordis.patch.yml`. Unknown keys, invalid types, and out-of-range values fail during plugin load. See [schemas/config.schema.json](../schemas/config.schema.json).

## Top-level fields

| Field | Type / Range | Default | Description |
|---|---|---|---|
| `mode` | `minimal` / `standard` / `strict` | `standard` | Default enhancement mode. |
| `defaultFramework` | string | `auto` | Framework ID, or `auto` to select by task type and mode. |
| `maxDraftChars` | 200–50000 | 20000 | Maximum accepted draft length. |
| `maxResultChars` | 200–80000 | 40000 | Maximum enhanced result length. |
| `maxOutputTokens` | 128–16384 | 2000 | Model output token limit. |
| `timeoutMs` | 1000–180000 | 45000 | Model request timeout. |
| `temperature` | 0–1 | 0.2 | Enhancement sampling temperature. |
| `maxIterations` | 1–10 | 5 | Maximum iteration rounds. |
| `includeAssistantMessages` | boolean | `false` | Include assistant replies in conversation context. |
| `maxConversationMessages` | 0–50 | 12 | Recent conversation messages considered. |
| `maxConversationChars` | 0–50000 | 8000 | Conversation character budget. |
| `context` | object | see below | Project/context sampling policy. |
| `privacy` | object | see below | Redaction and sensitive-draft policy. |
| `persistFrameworks` | boolean | `false` | Persist imported custom frameworks. |
| `frameworksFile` | string | unset | Required when `persistFrameworks` is true. |
| `provider` / `model` | string pair | unset | Optional fixed model route; both must be supplied together. |

## Context fields

| Field | Range | Default | Description |
|---|---|---:|---|
| `enabled` | boolean | `true` | Enable project context collection. |
| `maxFiles` | 0–30 | 10 | Files read for the model. |
| `maxFileBytes` | 1024–262144 | 16384 | Per-file character limit. |
| `maxTotalBytes` | 4096–524288 | 98304 | Total file, tree, and conversation budget. |
| `maxTreeEntries` | 0–1000 | 160 | Compact project tree entries. |
| `maxScanDirs` | 0–2000 | 600 | Directories traversed. |
| `maxIndexFiles` | 0–20000 | 10000 | Files considered while indexing. |
| `maxIndexSources` | 0–8000 | 1200 | Source files considered while indexing. |
| `maxIndexedFileBytes` | 1024–1048576 | 262144 | Files larger than this are skipped. |
| `maxDepth` | 0–10 | 7 | Directory traversal depth. |

Context collection also ignores dependency/build/cache directories and sensitive filenames. Assistant messages are excluded unless `includeAssistantMessages` is true; synthetic user messages are always excluded.

## Privacy fields

| Field | Type | Default | Description |
|---|---|---|---|
| `redactSecrets` | boolean | `true` | Redact credential-like strings in project/conversation context. |
| `blockSensitiveDraft` | boolean | `true` | Reject drafts containing high-confidence credentials or private keys. |
| `maxRedactions` | 1–1000 | 200 | Maximum redactions per context collection. |

`blockSensitiveDraft` is intentionally conservative. Disabling it means the selected model provider may receive raw credentials.

## Framework persistence

The plugin keeps imported custom frameworks in memory. To persist them across restarts:

```yaml
persistFrameworks: true
frameworksFile: /absolute/path/to/dsh-prompt-weaver-frameworks.json
```

The file is written only after an explicit import. Configuration exports include custom frameworks, but not built-in frameworks, drafts, history, provider credentials, or context.

## Example

```yaml
- insert:
    - id: prompt-weaver
      name: dsh-prompt-weaver
      config:
        mode: strict
        defaultFramework: auto
        maxDraftChars: 12000
        timeoutMs: 60000
        context:
          enabled: true
          maxFiles: 6
          maxTotalBytes: 49152
        privacy:
          redactSecrets: true
          blockSensitiveDraft: true
          maxRedactions: 200
```
