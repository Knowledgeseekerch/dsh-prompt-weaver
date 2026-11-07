const MAX_DIFF_TOKENS = 1200

export function tokenize(text) {
  return String(text ?? '')
    .split(/(\s+|[^\p{L}\p{N}_]+)/u)
    .filter(token => token.length > 0)
}

export function diffTokens(original, enhanced) {
  const left = tokenize(original)
  const right = tokenize(enhanced)
  if (left.length * right.length > MAX_DIFF_TOKENS * MAX_DIFF_TOKENS) {
    return coarseDiff(left, right)
  }
  const table = lcsTable(left, right)
  const operations = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      pushOperation(operations, 'equal', left[i])
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      pushOperation(operations, 'delete', left[i])
      i += 1
    } else {
      pushOperation(operations, 'insert', right[j])
      j += 1
    }
  }
  while (i < left.length) {
    pushOperation(operations, 'delete', left[i])
    i += 1
  }
  while (j < right.length) {
    pushOperation(operations, 'insert', right[j])
    j += 1
  }
  return mergeOperations(operations)
}

export function renderUnifiedDiff(original, enhanced) {
  const operations = diffTokens(original, enhanced)
  const lines = []
  for (const operation of operations) {
    const text = operation.text.replace(/\n/gu, '\\n')
    if (operation.type === 'equal') lines.push(`  ${text}`)
    else if (operation.type === 'delete') lines.push(`- ${text}`)
    else if (operation.type === 'insert') lines.push(`+ ${text}`)
    else {
      lines.push(`- ${text}`)
      lines.push(`+ ${text}`)
    }
  }
  return lines.join('\n')
}

export function diffSummary(original, enhanced) {
  const operations = diffTokens(original, enhanced)
  const inserted = operations.filter(operation => operation.type === 'insert' || operation.type === 'replace')
  const deleted = operations.filter(operation => operation.type === 'delete' || operation.type === 'replace')
  return {
    insertedCount: inserted.length,
    deletedCount: deleted.length,
    equalCount: operations.filter(operation => operation.type === 'equal').length,
  }
}

function lcsTable(left, right) {
  const table = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1))
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  return table
}

function coarseDiff(left, right) {
  const prefixLength = commonPrefix(left, right)
  const suffixLength = commonSuffix(left.slice(prefixLength), right.slice(prefixLength))
  const operations = []
  for (let index = 0; index < prefixLength; index += 1) pushOperation(operations, 'equal', left[index])
  for (const token of left.slice(prefixLength, left.length - suffixLength)) pushOperation(operations, 'delete', token)
  for (const token of right.slice(prefixLength, right.length - suffixLength)) pushOperation(operations, 'insert', token)
  for (const token of left.slice(left.length - suffixLength)) pushOperation(operations, 'equal', token)
  return mergeOperations(operations)
}

function commonPrefix(left, right) {
  let index = 0
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1
  return index
}

function commonSuffix(left, right) {
  let index = 0
  while (index < left.length && index < right.length && left[left.length - 1 - index] === right[right.length - 1 - index]) index += 1
  return index
}

function pushOperation(operations, type, text) {
  const previous = operations[operations.length - 1]
  if (previous !== undefined && previous.type === type) {
    previous.text += text
    return
  }
  operations.push({ type, text })
}

function mergeOperations(operations) {
  return mergeReplacePairs(operations).map(operation => Object.freeze({ ...operation }))
}

function mergeReplacePairs(operations) {
  const merged = []
  let index = 0
  while (index < operations.length) {
    const current = operations[index]
    const next = operations[index + 1]
    if (current.type === 'delete' && next?.type === 'insert') {
      merged.push({ type: 'replace', text: current.text, replacement: next.text })
      index += 2
      continue
    }
    if (current.type === 'insert' && next?.type === 'delete') {
      merged.push({ type: 'replace', text: next.text, replacement: current.text })
      index += 2
      continue
    }
    merged.push({ ...current })
    index += 1
  }
  return merged
}
