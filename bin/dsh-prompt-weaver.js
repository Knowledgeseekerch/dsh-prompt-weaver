#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { readConfig } from '../src/core/config.js'
import { createFrameworkStore, validateFramework } from '../src/core/frameworks.js'
import { createPromptWeaverEngine } from '../src/core/engine.js'
import { createLocalModelProvider } from '../src/core/local-provider.js'
import { exportConfiguration, importConfiguration } from '../src/core/config-io.js'
import { renderUnifiedDiff } from '../src/core/diff.js'
import { normalizeError } from '../src/core/errors.js'
import { redactSecrets } from '../src/core/privacy.js'
import { comparePrompts } from '../src/core/quality.js'
import { safeJsonParse } from '../src/core/json.js'

const HELP = `dsh-prompt-weaver

Usage:
  dsh-prompt-weaver enhance [text] [options]
  dsh-prompt-weaver frameworks list [options]
  dsh-prompt-weaver frameworks validate <directory> [options]
  dsh-prompt-weaver frameworks import <file> [options]
  dsh-prompt-weaver frameworks export [options]
  dsh-prompt-weaver config export [options]
  dsh-prompt-weaver config import <file> [options]
  dsh-prompt-weaver compare <original> <enhanced>

Options:
  --config <file>          JSON config file
  --frameworks <file>      framework storage file (overrides config.frameworksFile)
  --input <file>           read draft from file
  --output <file>          write result to file
  --context <file>         explicit JSON context for enhance
  --framework <id>         framework id or auto
  --mode <mode>            minimal | standard | strict
  --task <type>            task type or auto
  --locale <locale>        zh | en
  --conflict <policy>      error | replace | skip
  --json                   emit machine-readable JSON

The CLI uses a deterministic local provider. It does not call a model, does not scan directories implicitly, and does not write unless --output or an import/export command is used.
`

async function main(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string' },
      frameworks: { type: 'string' },
      input: { type: 'string' },
      output: { type: 'string' },
      context: { type: 'string' },
      framework: { type: 'string' },
      mode: { type: 'string' },
      task: { type: 'string' },
      locale: { type: 'string' },
      conflict: { type: 'string', default: 'error' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  const command = positionals[0]
  if (command === undefined || values.help) {
    process.stdout.write(`${HELP}\n`)
    return 0
  }

  const config = loadConfig(values.config)
  const frameworksPath = values.frameworks ?? config.frameworksFile
  const frameworkStore = createFrameworkStore({
    frameworksFile: frameworksPath,
    fs: frameworksPath === undefined ? undefined : { readFileSync, writeFileSync },
  })

  if (command === 'frameworks' || command === 'config') {
    return runFrameworkOrConfigCommand(command, positionals, values, config, frameworkStore, frameworksPath)
  }
  if (command === 'compare') {
    return runCompare(positionals)
  }
  if (command === 'enhance') {
    return runEnhance(positionals, values, config, frameworkStore)
  }

  process.stderr.write(`Unknown command: ${command}\n\n${HELP}\n`)
  return 2
}

function runFrameworkOrConfigCommand(command, positionals, values, config, frameworkStore, frameworksPath) {
  const action = positionals[1]
  if (command === 'frameworks' && action === 'list') {
    const frameworks = frameworkStore.list()
    if (values.json) {
      writeOutput(values, JSON.stringify({ ok: true, frameworks }, null, 2))
    } else {
      for (const framework of frameworks) {
        process.stdout.write(`${framework.id}\t${framework.builtin ? 'built-in' : 'custom'}\t${framework.sectionCount} sections\n`)
      }
    }
    return 0
  }

  if (command === 'frameworks' && action === 'validate') {
    const directory = positionals[2]
    if (directory === undefined) {
      process.stderr.write('frameworks validate requires a directory\n')
      return 2
    }
    const files = listJsonFiles(directory)
    for (const file of files) {
      const parsed = safeJsonParse(readFileSync(file, 'utf8'), file)
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.frameworks)
          ? parsed.frameworks
          : parsed.schemaVersion !== undefined && parsed.id !== undefined
            ? [parsed]
            : []
      if (items.length === 0) {
        process.stderr.write(`${file}: expected a framework, an array, or { frameworks: [...] }\n`)
        return 1
      }
      for (const item of items) validateFramework(item)
    }
    process.stdout.write(`ok: ${files.length} framework file(s) valid\n`)
    return 0
  }

  if (command === 'frameworks' && action === 'import') {
    const file = positionals[2]
    if (file === undefined) return usageError('frameworks import requires a file')
    if (frameworksPath === undefined) return usageError('frameworks import requires --frameworks <file> or config.frameworksFile')
    const parsed = safeJsonParse(readFileSync(file, 'utf8'), file)
    const report = frameworkStore.importFrameworks(parsed, { conflict: values.conflict })
    frameworkStore.saveFrameworkFile(frameworksPath, { readFileSync, writeFileSync })
    writeOutput(values, JSON.stringify({ ok: true, ...report }, null, 2))
    return 0
  }

  if (command === 'frameworks' && action === 'export') {
    if (frameworksPath === undefined) return usageError('frameworks export requires --frameworks <file> or config.frameworksFile')
    const output = { schemaVersion: 1, frameworks: frameworkStore.exportFrameworks() }
    writeOutput(values, JSON.stringify(output, null, 2))
    return 0
  }

  if (command === 'config' && action === 'export') {
    const bundle = exportConfiguration({ config, frameworkStore })
    writeOutput(values, JSON.stringify(bundle, null, 2))
    return 0
  }

  if (command === 'config' && action === 'import') {
    const file = positionals[2]
    if (file === undefined) return usageError('config import requires a file')
    const parsed = safeJsonParse(readFileSync(file, 'utf8'), file)
    const report = importConfiguration(parsed, { frameworkStore, conflict: values.conflict })
    if (frameworksPath !== undefined) {
      frameworkStore.saveFrameworkFile(frameworksPath, { readFileSync, writeFileSync })
    }
    writeOutput(values, JSON.stringify({ ok: true, ...report }, null, 2))
    return 0
  }

  process.stderr.write(`Unknown ${command} command: ${action ?? ''}\n\n${HELP}\n`)
  return 2
}

async function runEnhance(positionals, values, config, frameworkStore) {
  let text = positionals.slice(1).join(' ').trim()
  if (values.input !== undefined) {
    text = readFileSync(resolve(values.input), 'utf8')
  }
  if (text.trim().length === 0) return usageError('enhance requires text or --input <file>')

  const explicitContext = values.context === undefined ? undefined : readContext(values.context)
  const engine = createPromptWeaverEngine({
    config,
    frameworkStore,
    provider: createLocalModelProvider(),
    contextProvider: explicitContext === undefined ? undefined : () => explicitContext,
  })

  try {
    const result = await engine.enhance({
      text,
      mode: values.mode,
      frameworkId: values.framework,
      taskType: values.task,
      locale: values.locale,
    })
    if (values.json) {
      writeOutput(values, JSON.stringify(result, null, 2))
    } else {
      writeOutput(values, `${result.text}\n`)
    }
    return 0
  } catch (error) {
    const failure = normalizeError(error)
    process.stderr.write(`${failure.reason}: ${failure.message}\n`)
    return 1
  }
}

function runCompare(positionals) {
  const [, originalPath, enhancedPath] = positionals
  if (originalPath === undefined || enhancedPath === undefined) return usageError('compare requires <original> <enhanced>')
  const original = readFileSync(resolve(originalPath), 'utf8')
  const enhanced = readFileSync(resolve(enhancedPath), 'utf8')
  const comparison = comparePrompts(original, enhanced)
  process.stdout.write(JSON.stringify(comparison, null, 2))
  process.stdout.write(`\n\n${renderUnifiedDiff(original, enhanced)}\n`)
  return 0
}

function loadConfig(path) {
  if (path === undefined) return readConfig()
  return readConfig(safeJsonParse(readFileSync(resolve(path), 'utf8'), 'config file'))
}

function readContext(path) {
  const parsed = safeJsonParse(readFileSync(resolve(path), 'utf8'), 'context file')
  const files = Array.isArray(parsed.files) ? parsed.files : []
  const conversation = Array.isArray(parsed.conversation) ? parsed.conversation : []
  const redactedFiles = files.map(file => ({
    id: file.id ?? `file:${file.path}`,
    path: String(file.path ?? ''),
    content: redactSecrets(String(file.content ?? ''), 200).text,
    truncated: Boolean(file.truncated),
  }))
  const redactedConversation = conversation.map(message => ({
    role: String(message.role ?? 'user'),
    text: redactSecrets(String(message.text ?? ''), 200).text,
  }))
  const tree = Array.isArray(parsed.tree) ? parsed.tree.map(String) : []
  return {
    projectAvailable: true,
    files: redactedFiles,
    tree,
    conversation: redactedConversation,
    conversationMessages: redactedConversation.length,
    redactions: [
      ...redactedFiles.flatMap(file => redactSecrets(file.content, 1).redactions),
      ...redactedConversation.flatMap(message => redactSecrets(message.text, 1).redactions),
    ],
    totalBytes: measureContext(redactedFiles, tree, redactedConversation),
  }
}

function measureContext(files, tree, conversation) {
  return files.reduce((sum, file) => sum + file.content.length, 0) +
    tree.join('\n').length +
    conversation.reduce((sum, message) => sum + message.text.length, 0)
}

function listJsonFiles(directory) {
  const root = resolve(directory)
  if (!existsSync(root)) return []
  const found = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        stack.push(path)
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        found.push(path)
      }
    }
  }
  return found.sort()
}

function writeOutput(values, text) {
  if (values.output === undefined) {
    process.stdout.write(text)
    if (!text.endsWith('\n')) process.stdout.write('\n')
    return
  }
  writeFileSync(resolve(values.output), text, 'utf8')
}

function usageError(message) {
  process.stderr.write(`${message}\n\n${HELP}\n`)
  return 2
}

main(process.argv.slice(2)).then(code => {
  process.exitCode = code
}).catch(error => {
  const failure = normalizeError(error)
  process.stderr.write(`${failure.reason}: ${failure.message}\n`)
  process.exitCode = 1
})
