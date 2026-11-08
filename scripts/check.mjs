#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const errors = []

function walk(directory, filter) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'release') continue
      found.push(...walk(path, filter))
    } else if (entry.isFile() && filter(entry.name)) {
      found.push(path)
    }
  }
  return found
}

const jsFiles = walk(root, name => /\.(js|mjs|cjs)$/u.test(name) && !name.endsWith('.min.js'))
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    errors.push(`${file}\n${result.stderr || result.stdout}`)
  }
}

const jsonFiles = walk(root, name => /\.json$/u.test(name))
for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    errors.push(`${file}: ${error.message}`)
  }
}

// 备份文件不得进入仓库：它们会被打包、被搜索命中，也容易与正式源码混淆。
const backupFiles = walk(root, name => /\.bak/u.test(name))
for (const file of backupFiles) {
  errors.push(`${file}: backup files must not live in the repository`)
}

if (errors.length > 0) {
  process.stderr.write(`check failed:\n\n${errors.join('\n\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`check ok: ${jsFiles.length} JavaScript file(s), ${jsonFiles.length} JSON file(s)\n`)
}
