#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const problems = []

function walk(directory, extensions) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'release') continue
      found.push(...walk(path, extensions))
    } else if (entry.isFile() && extensions.some(extension => entry.name.endsWith(extension))) {
      found.push(path)
    }
  }
  return found
}

const files = walk(root, ['.js', '.mjs', '.json', '.md', '.yml', '.yaml'])

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/u)
  lines.forEach((line, index) => {
    if (/[ \t]+$/u.test(line)) {
      problems.push(`${file}:${index + 1}: trailing whitespace`)
    }
    if (line.includes('\t')) {
      problems.push(`${file}:${index + 1}: tab indentation`)
    }
    if (/T(?:ODO)|F(?:IXME)|X(?:XX)(?![\p{L}])/u.test(line)) {
      problems.push(`${file}:${index + 1}: unfinished marker`)
    }
    if (/(?:api[_-]?key|password|secret)\s*[:=]\s*['"][^'"]{12,}/iu.test(line)) {
      problems.push(`${file}:${index + 1}: possible hard-coded credential`)
    }
  })
}

if (problems.length > 0) {
  process.stderr.write(`lint failed:\n${problems.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`lint ok: ${files.length} file(s)\n`)
}
