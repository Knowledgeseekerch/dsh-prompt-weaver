import { BUILTIN_FRAMEWORKS } from './builtins.js'
import { FRAMEWORK_SCHEMA_VERSION, MAX_FRAMEWORKS } from './constants.js'
import { PromptWeaverError } from './errors.js'
import { safeJsonParse } from './json.js'
import { rejectUnknownKeys, requireBoolean, requireEnum, requireInteger, requireLocalizedText, requireObject, requireString } from './validate.js'
import { freezeDeep, isPlainObject, stableStringify } from './utils.js'

const FRAMEWORK_KEYS = new Set(['schemaVersion', 'id', 'name', 'description', 'taskTypes', 'sections', 'builtin'])
const SECTION_KEYS = new Set(['id', 'title', 'guidance', 'required'])
const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u
const TASK_TYPE_PATTERN = /^[a-z][a-z0-9-]{1,31}$/u
const BUILTIN_IDS = new Set(BUILTIN_FRAMEWORKS.map(framework => framework.id))

function normalizeArray(value, label, maxLength) {
  if (!Array.isArray(value)) {
    throw new PromptWeaverError('invalid-framework', `${label} must be an array.`)
  }
  if (value.length > maxLength) {
    throw new PromptWeaverError('invalid-framework', `${label} cannot contain more than ${maxLength} items.`)
  }
  return value
}

export function validateFramework(input) {
  requireObject(input, 'framework')
  rejectUnknownKeys(input, FRAMEWORK_KEYS, 'framework')
  if (input.builtin === true) {
    throw new PromptWeaverError('invalid-framework', 'Custom frameworks cannot declare builtin=true.')
  }
  if (input.schemaVersion !== FRAMEWORK_SCHEMA_VERSION) {
    throw new PromptWeaverError('invalid-framework', `framework.schemaVersion must be ${FRAMEWORK_SCHEMA_VERSION}.`)
  }
  const id = requireString(input.id, 'framework.id', { minLength: 3, maxLength: 64 })
  if (!ID_PATTERN.test(id)) {
    throw new PromptWeaverError('invalid-framework', 'framework.id must match /^[a-z][a-z0-9-]{1,63}$/.')
  }
  if (BUILTIN_IDS.has(id)) {
    throw new PromptWeaverError('invalid-framework', `framework.id "${id}" conflicts with a built-in framework.`)
  }

  const taskTypes = normalizeArray(input.taskTypes, 'framework.taskTypes', 20)
  if (taskTypes.length === 0) {
    throw new PromptWeaverError('invalid-framework', 'framework.taskTypes cannot be empty.')
  }
  for (const taskType of taskTypes) {
    if (typeof taskType !== 'string' || !TASK_TYPE_PATTERN.test(taskType)) {
      throw new PromptWeaverError('invalid-framework', `framework.taskTypes contains an invalid task type: ${JSON.stringify(taskType)}`)
    }
  }

  const sections = normalizeArray(input.sections, 'framework.sections', 12)
  if (sections.length === 0) {
    throw new PromptWeaverError('invalid-framework', 'framework.sections cannot be empty.')
  }
  const seen = new Set()
  const validatedSections = sections.map((section, index) => {
    requireObject(section, `framework.sections[${index}]`)
    rejectUnknownKeys(section, SECTION_KEYS, `framework.sections[${index}]`)
    const sectionId = requireString(section.id, `framework.sections[${index}].id`, { minLength: 1, maxLength: 64 })
    if (!ID_PATTERN.test(sectionId)) {
      throw new PromptWeaverError('invalid-framework', `framework.sections[${index}].id is invalid.`)
    }
    if (seen.has(sectionId)) {
      throw new PromptWeaverError('invalid-framework', `framework.sections has duplicate id "${sectionId}".`)
    }
    seen.add(sectionId)
    return freezeDeep({
      id: sectionId,
      title: requireLocalizedText(section.title, `framework.sections[${index}].title`, { maxLength: 80 }),
      guidance: requireLocalizedText(section.guidance, `framework.sections[${index}].guidance`, { maxLength: 1200 }),
      required: section.required === undefined ? false : requireBoolean(section.required, `framework.sections[${index}].required`),
    })
  })

  return freezeDeep({
    schemaVersion: FRAMEWORK_SCHEMA_VERSION,
    id,
    name: requireLocalizedText(input.name, 'framework.name', { maxLength: 120 }),
    description: requireLocalizedText(input.description, 'framework.description', { maxLength: 500 }),
    taskTypes: freezeDeep([...new Set(taskTypes)]),
    sections: validatedSections,
  })
}

export function createFrameworkStore(options = {}) {
  const frameworks = new Map()
  for (const framework of BUILTIN_FRAMEWORKS) {
    frameworks.set(framework.id, freezeDeep({ ...framework, builtin: true }))
  }

  if (options.frameworksFile !== undefined) {
    loadFrameworkFile(options.frameworksFile, options.fs, { conflict: 'error' })
  }

  function register(input, { conflict = 'error', source = 'custom' } = {}) {
    const framework = validateFramework(input)
    if (frameworks.has(framework.id)) {
      if (conflict === 'error') {
        throw new PromptWeaverError('framework-conflict', `Framework "${framework.id}" already exists.`)
      }
      if (conflict === 'skip') {
        return { status: 'skipped', framework }
      }
    }
    if (frameworks.size >= MAX_FRAMEWORKS + BUILTIN_FRAMEWORKS.length) {
      throw new PromptWeaverError('framework-limit', `The framework store cannot exceed ${MAX_FRAMEWORKS} custom frameworks.`)
    }
    const stored = source === 'builtin' ? framework : freezeDeep({ ...framework, source })
    frameworks.set(framework.id, stored)
    return { status: 'registered', framework }
  }

  function unregister(id) {
    const framework = frameworks.get(id)
    if (framework === undefined) return false
    if (framework.builtin === true) {
      throw new PromptWeaverError('builtin-framework', `Built-in framework "${id}" cannot be removed.`)
    }
    return frameworks.delete(id)
  }

  function get(id) {
    return frameworks.get(id)
  }

  function list() {
    return [...frameworks.values()]
      .map(framework => ({
        id: framework.id,
        name: framework.name,
        description: framework.description,
        taskTypes: framework.taskTypes,
        sectionCount: framework.sections.length,
        builtin: framework.builtin === true,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  function select({ taskType = 'general', mode = 'standard', frameworkId = 'auto' } = {}) {
    if (frameworkId !== 'auto') {
      const framework = frameworks.get(frameworkId)
      if (framework === undefined) {
        throw new PromptWeaverError('unknown-framework', `Framework "${frameworkId}" is not registered.`)
      }
      return framework
    }
    if (mode === 'minimal') {
      const concise = frameworks.get('concise')
      if (concise !== undefined) return concise
    }
    const matches = [...frameworks.values()].filter(framework => framework.taskTypes.includes(taskType))
    if (matches.length > 0) {
      return matches.find(framework => framework.builtin === true) ?? matches[0]
    }
    const general = frameworks.get('general')
    if (general !== undefined) return general
    return [...frameworks.values()][0]
  }

  function exportFrameworks({ includeBuiltins = false } = {}) {
    return [...frameworks.values()]
      .filter(framework => includeBuiltins || framework.builtin !== true)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(framework => stripInternal(framework))
  }

  function importFrameworks(input, { conflict = 'error' } = {}) {
    requireEnum(conflict, ['error', 'replace', 'skip'], 'conflict')
    const incoming = normalizeImport(input)
    const report = { imported: [], skipped: [], replaced: [] }
    for (const item of incoming) {
      const existed = frameworks.has(item?.id)
      const result = register(item, { conflict })
      if (result.status === 'skipped') {
        report.skipped.push(result.framework.id)
      } else if (existed) {
        report.replaced.push(result.framework.id)
      } else {
        report.imported.push(result.framework.id)
      }
    }
    return report
  }

  function loadFrameworkFile(path, fs, { conflict } = {}) {
    if (fs === undefined) {
      throw new PromptWeaverError('framework-storage', 'A filesystem adapter is required to load frameworks.')
    }
    if (typeof fs.readFileSync !== 'function') {
      throw new PromptWeaverError('framework-storage', 'The filesystem adapter does not support readFileSync.')
    }
    let text
    try {
      text = fs.readFileSync(path, 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') return { imported: [], skipped: [], replaced: [] }
      throw new PromptWeaverError('framework-storage', `Cannot read framework file: ${error.message}`)
    }
    const parsed = safeJsonParse(text, 'framework file')
    return importFrameworks(parsed, { conflict })
  }

  function saveFrameworkFile(path, fs) {
    if (fs === undefined || typeof fs.writeFileSync !== 'function') {
      throw new PromptWeaverError('framework-storage', 'A filesystem adapter with writeFileSync is required.')
    }
    const payload = `${stableStringify({ schemaVersion: FRAMEWORK_SCHEMA_VERSION, frameworks: exportFrameworks() })}\n`
    fs.writeFileSync(path, payload, 'utf8')
    return { path, frameworkCount: exportFrameworks().length }
  }

  function stripInternal(framework) {
    const { source, ...rest } = framework
    return freezeDeep(rest)
  }

  function normalizeImport(input) {
    if (Array.isArray(input)) return input
    if (isPlainObject(input) && Array.isArray(input.frameworks)) return input.frameworks
    throw new PromptWeaverError('invalid-framework-bundle', 'Framework input must be an array or { frameworks: [...] }.')
  }

  return freezeDeep({
    register,
    unregister,
    get,
    list,
    select,
    exportFrameworks,
    importFrameworks,
    loadFrameworkFile,
    saveFrameworkFile,
    size: () => frameworks.size,
  })
}
