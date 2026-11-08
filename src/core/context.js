import { redactSecrets } from './privacy.js'
import { assertAbort } from './utils.js'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out', 'coverage',
  '.venv', 'venv', '__pycache__', '.cache', '.next', '.turbo', '.dsh', '.idea', '.vscode',
])
const SENSITIVE_BASENAMES = /^(?:^|\.)(?:env|env\..*|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa|id_dsa|id_ed25519|credentials|secrets?.*)$/iu
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.jsonc', '.yaml', '.yml', '.toml',
  '.md', '.mdx', '.txt', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h',
  '.cpp', '.hpp', '.cs', '.php', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1', '.sql', '.css', '.scss', '.html',
])
const KEY_BASENAMES = new Set(['agents.md', 'readme.md', 'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod', 'pnpm-workspace.yaml'])
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.sql'])

export async function collectContext({ fs, root, session, draft, config, signal }) {
  assertAbort(signal)
  const conversation = collectConversation(session, config)
  assertAbort(signal)
  if (!config.context.enabled || fs === undefined || root === undefined || root === null || root === '') {
    return {
      projectAvailable: false,
      files: [],
      tree: [],
      conversation,
      conversationMessages: conversation.length,
      redactions: countRedactions(conversation.map(message => message.text)),
      totalBytes: conversation.reduce((sum, message) => sum + message.text.length, 0),
    }
  }

  try {
    const project = await collectProject({ fs, root, draft, config, signal })
    const redactEnabled = config.privacy.redactSecrets !== false
    const redactedFiles = project.files.map(file =>
      redactEnabled ? redactSecrets(file.content, config.privacy.maxRedactions) : { text: file.content, redactions: [] })
    const files = project.files.map((file, index) => ({
      id: `file:${index + 1}`,
      path: file.path,
      content: redactedFiles[index].text,
      truncated: file.truncated,
    }))
    const redactions = [
      ...redactedFiles.flatMap(result => result.redactions),
      ...conversationRedactions(conversation, config),
    ]
    const conversationTexts = redactConversation(conversation, config)
    const fitted = fitBudget({ files, tree: project.tree, conversation: conversationTexts, config })
    return {
      projectAvailable: true,
      files: fitted.files,
      tree: fitted.tree,
      conversation: fitted.conversation,
      conversationMessages: fitted.conversation.length,
      redactions: redactions.slice(0, config.privacy.maxRedactions),
      totalBytes: measureContextBytes(fitted),
    }
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'aborted') throw error
    return {
      projectAvailable: false,
      files: [],
      tree: [],
      conversation,
      conversationMessages: conversation.length,
      redactions: [],
      totalBytes: conversation.reduce((sum, message) => sum + message.text.length, 0),
      warning: 'project-context-unavailable',
    }
  }
}

async function collectProject({ fs, root, draft, config, signal }) {
  const rootTarget = await fs.resolve(String(root))
  const rootDisplay = displayPath(rootTarget, String(root))
  const queue = [{ target: rootTarget, path: rootDisplay, depth: 0 }]
  const directories = new Map()
  const files = []
  let scannedDirs = 0
  let indexedFiles = 0
  let indexedSources = 0

  while (queue.length > 0) {
    assertAbort(signal)
    if (scannedDirs >= config.context.maxScanDirs || indexedFiles >= config.context.maxIndexFiles) break
    const directory = queue.shift()
    if (directory.depth > config.context.maxDepth) continue
    if (directories.has(directory.path)) continue
    directories.set(directory.path, true)
    scannedDirs += 1
    let entries
    try {
      entries = await fs.listDir(directory.target)
    } catch {
      continue
    }
    for (const entry of Array.isArray(entries) ? entries : []) {
      assertAbort(signal)
      const name = entry?.name
      if (typeof name !== 'string' || name.length === 0) continue
      if (entry.type === 'directory' || entry.type === 'dir') {
        if (IGNORED_DIRS.has(name) || name.startsWith('.') && name !== '.github') continue
        queue.push({
          target: entry.target,
          path: joinPath(directory.path, name),
          depth: directory.depth + 1,
        })
        continue
      }
      if (entry.type !== 'file' && entry.type !== 'symlink') continue
      if (isSensitiveName(name)) continue
      const lowerName = name.toLowerCase()
      const extension = extensionOf(name)
      const isText = TEXT_EXTENSIONS.has(extension) || KEY_BASENAMES.has(lowerName)
      if (!isText) continue
      indexedFiles += 1
      if (indexedFiles > config.context.maxIndexFiles) break
      if (SOURCE_EXTENSIONS.has(extension)) {
        indexedSources += 1
        if (indexedSources > config.context.maxIndexSources) continue
      }
      files.push({
        target: entry.target,
        path: joinPath(directory.path, name),
        name: lowerName,
        extension,
        score: scoreFile({ path: joinPath(directory.path, name), name: lowerName, extension, draft, depth: directory.depth }),
      })
    }
  }

  const selected = selectFiles(files, config.context.maxFiles)
  const read = []
  let remainingTotal = config.context.maxTotalBytes
  for (const file of selected) {
    assertAbort(signal)
    if (remainingTotal <= 0) break
    try {
      // 能拿到 size 就先判，避免把超大文件整个读进内存；拿不到再退回读后检查。
      if (typeof fs.stat === 'function') {
        try {
          const info = await fs.stat(file.target)
          const size = typeof info === 'number' ? info : info?.info?.size ?? info?.size
          if (typeof size === 'number' && size > config.context.maxIndexedFileBytes) continue
        } catch {
          // stat 失败不阻断读取，交给下面的读后检查
        }
      }
      const raw = await fs.readText(file.target)
      const limit = Math.min(config.context.maxFileBytes, remainingTotal)
      const content = typeof raw === 'string' ? raw : String(raw ?? '')
      if (content.includes('\u0000')) continue
      if (content.length > config.context.maxIndexedFileBytes) continue
      read.push({
        path: file.path,
        content: content.slice(0, limit),
        truncated: content.length > limit,
      })
      remainingTotal -= Math.min(content.length, limit)
    } catch {
      continue
    }
  }

  return { files: read, tree: renderTree({ rootDisplay, directories, files, config }) }
}

function collectConversation(session, config) {
  const events = sessionEvents(session)
  const messages = []
  let chars = 0
  for (let index = events.length - 1; index >= 0 && messages.length < config.maxConversationMessages; index -= 1) {
    const event = events[index]
    const text = eventText(event)
    if (text === undefined) continue
    const includeAssistant = config.includeAssistantMessages && event?.type === 'assistant/message'
    const isUser = event?.type === 'user/message' && event?.data?.source?.kind === 'user'
    if (!isUser && !includeAssistant) continue
    const clipped = text.slice(0, Math.max(0, config.maxConversationChars - chars))
    if (clipped.length === 0) continue
    messages.unshift({ role: isUser ? 'user' : 'assistant', text: clipped })
    chars += clipped.length
    if (chars >= config.maxConversationChars) break
  }
  return messages
}

function sessionEvents(session) {
  if (typeof session?.snapshotEvents === 'function') return session.snapshotEvents() ?? []
  if (Array.isArray(session?.events)) return session.events
  return []
}

function eventText(event) {
  if (event?.type === 'user/message') {
    return contentText(event?.data?.content)
  }
  if (event?.type === 'assistant/message') {
    return contentText(event?.data?.message?.content)
  }
  return undefined
}

function contentText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  return content
    .filter(part => part?.type === 'text' && typeof part.text === 'string')
    .map(part => part.text)
    .join('\n')
}

function scoreFile({ path, name, extension, draft, depth }) {
  const text = draft.originalText.toLowerCase()
  // Windows 上 path 可能带反斜杠，而下面几条按 /src/ 这类形态做判断，
  // 不归一化会让核心源文件在 Windows 项目里拿不到这档加分。
  const pathLower = path.replace(/\\/gu, '/').toLowerCase()
  let score = 0
  if (draft.protectedItems.some(item => item.kind === 'file-reference' && (pathLower.includes(item.text.toLowerCase()) || item.text.toLowerCase().includes(pathLower)))) score += 80
  if (text.includes(pathLower)) score += 60
  if (draft.naturalText.toLowerCase().includes(name)) score += 30
  if (KEY_BASENAMES.has(name)) score += 40
  if (SOURCE_EXTENSIONS.has(extension)) score += 15
  if (pathLower.includes('/src/') || pathLower.startsWith('src/')) score += 12
  if (pathLower.includes('test') || pathLower.includes('spec')) score -= 10
  score -= Math.min(15, depth * 3)
  return score
}

function selectFiles(files, maxFiles) {
  if (maxFiles <= 0) return []
  const sorted = [...files].sort((left, right) => right.score - left.score)
  const selected = []
  const groups = new Map()
  for (const file of sorted) {
    const group = workspaceGroup(file.path)
    const count = groups.get(group) ?? 0
    if (count >= 2) continue
    groups.set(group, count + 1)
    selected.push(file)
    if (selected.length >= maxFiles) break
  }
  return selected
}

function workspaceGroup(path) {
  const normalized = path.replace(/\\/gu, '/')
  const parts = normalized.split('/')
  if (parts[0] === 'packages' && parts.length > 2) return `packages/${parts[1]}`
  if (parts[0] === 'apps' && parts.length > 1) return `apps/${parts[1]}`
  return normalized
}

function renderTree({ rootDisplay, directories, files, config }) {
  const entries = []
  const rootNormalized = rootDisplay.replace(/\\/gu, '/')
  const topDirs = [...directories.keys()]
    .map(path => path.replace(/\\/gu, '/'))
    .filter(path => path !== rootNormalized)
    .map(path => path.slice(rootNormalized.length + 1).split('/')[0])
    .filter((value, index, array) => value !== undefined && array.indexOf(value) === index)
    .slice(0, Math.max(0, config.context.maxTreeEntries))
  for (const dir of topDirs) entries.push(`${dir}/`)
  const representative = files
    .filter(file => SOURCE_EXTENSIONS.has(file.extension))
    .slice(0, Math.max(0, config.context.maxTreeEntries - entries.length))
  for (const file of representative) entries.push(file.path)
  return entries.slice(0, config.context.maxTreeEntries)
}

function fitBudget({ files, tree, conversation, config }) {
  const total = config.context.maxTotalBytes
  // 以前只裁 files，tree 与 conversation 原样带出去：
  // 两者相加超过 maxTotalBytes 时 remaining 直接变负，上限形同虚设。
  // 现在三样各有配额，files 只吃剩下的。
  const treeBudget = Math.floor(total * 0.2)
  const conversationBudget = Math.floor(total * 0.4)

  const fittedTree = []
  let treeBytes = 0
  for (const entry of tree) {
    const cost = entry.length + 1
    if (treeBytes + cost > treeBudget) break
    fittedTree.push(entry)
    treeBytes += cost
  }

  let messages = conversation.slice(0, config.maxConversationMessages)
  let conversationBytes = messages.reduce((sum, message) => sum + message.text.length, 0)
  // 超配额就从最旧的一端丢：越近的对话对当前请求越有用。
  while (messages.length > 0 && conversationBytes > conversationBudget) {
    conversationBytes -= messages[0].text.length
    messages = messages.slice(1)
  }

  let remaining = total - treeBytes - conversationBytes
  const fittedFiles = []
  for (const file of files) {
    if (remaining <= 0) break
    const limit = Math.min(config.context.maxFileBytes, remaining)
    const content = file.content.slice(0, limit)
    fittedFiles.push({ ...file, content, truncated: file.truncated || content.length < file.content.length })
    remaining -= content.length
  }
  return { files: fittedFiles, tree: fittedTree, conversation: messages }
}

function measureContextBytes(context) {
  return context.files.reduce((sum, file) => sum + file.content.length, 0) +
    context.tree.join('\n').length +
    context.conversation.reduce((sum, message) => sum + message.text.length, 0)
}

function redactConversation(conversation, config) {
  return conversation.map(message => ({
    role: message.role,
    text: redactSecrets(message.text, config.privacy.maxRedactions).text,
  }))
}

function conversationRedactions(conversation, config) {
  return conversation.flatMap(message => redactSecrets(message.text, config.privacy.maxRedactions).redactions)
}

function countRedactions(texts) {
  return texts.reduce((sum, text) => sum + redactSecrets(text, 1).redactions.length, 0)
}

function isSensitiveName(name) {
  const lower = name.toLowerCase()
  if (SENSITIVE_BASENAMES.test(lower)) return true
  return ['.env', '.pem', '.key', '.p12', '.pfx'].some(extension => lower.endsWith(extension)) ||
    ['id_rsa', 'id_dsa', 'id_ed25519', 'credentials.json', 'secrets.json'].includes(lower)
}

function extensionOf(name) {
  const index = name.lastIndexOf('.')
  return index === -1 ? '' : name.slice(index).toLowerCase()
}

function displayPath(target, fallback) {
  return typeof target?.displayPath === 'string' ? target.displayPath : fallback
}

function joinPath(parent, child) {
  if (parent.endsWith('/') || parent.endsWith('\\')) return `${parent}${child}`
  return `${parent}/${child}`
}
