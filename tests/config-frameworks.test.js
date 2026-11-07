import assert from 'node:assert/strict'
import test from 'node:test'

import { readConfig } from '../src/core/config.js'
import { createFrameworkStore, validateFramework } from '../src/core/frameworks.js'
import { BUILTIN_FRAMEWORKS } from '../src/core/builtins.js'

test('default config is frozen and valid', () => {
  const config = readConfig()
  assert.equal(config.mode, 'standard')
  assert.equal(config.defaultFramework, 'auto')
  assert.equal(config.context.maxFiles, 10)
  assert.equal(Object.isFrozen(config), true)
})

test('config rejects unknown keys and out-of-range values', () => {
  assert.throws(() => readConfig({ nope: 1 }), /unknown key\(s\)/)
  assert.throws(() => readConfig({ maxFiles: 1 }), /unknown key\(s\): maxFiles/)
  assert.throws(() => readConfig({ context: { maxFiles: 99 } }), /between 0 and 30/)
  assert.throws(() => readConfig({ provider: 'x' }), /provider and model must be supplied together/)
  assert.throws(() => readConfig({ persistFrameworks: true }), /frameworksFile is required/)
})

test('built-in frameworks remain frozen and registerable IDs are validated', () => {
  for (const framework of BUILTIN_FRAMEWORKS) {
    assert.equal(Object.isFrozen(framework), true)
    const cloned = validateFramework({ ...framework, id: `${framework.id}-check`, builtin: false })
    assert.equal(cloned.id, `${framework.id}-check`)
  }
  const store = createFrameworkStore()
  assert.throws(() => store.unregister('general'), /Built-in framework/)
})

test('custom frameworks register, select, and export', () => {
  const store = createFrameworkStore()
  const report = store.register({
    schemaVersion: 1,
    id: 'qa-bugbash',
    name: { zh: '质量测试', en: 'QA' },
    description: { zh: '测试框架', en: 'Testing' },
    taskTypes: ['debug'],
    sections: [
      { id: 'symptom', title: { zh: '症状', en: 'Symptom' }, guidance: { en: 'Symptom' } },
      { id: 'validation', title: { zh: '验证', en: 'Validation' }, guidance: { en: 'Validation' } },
    ],
  })
  assert.equal(report.status, 'registered')
  assert.equal(store.select({ taskType: 'debug', mode: 'standard' }).id, 'debugging')
  assert.equal(store.get('qa-bugbash').id, 'qa-bugbash')
  const exported = store.exportFrameworks()
  assert.equal(exported.length, 1)
  assert.equal(exported[0].id, 'qa-bugbash')
})

test('framework import conflict policies work', () => {
  const store = createFrameworkStore()
  const framework = {
    schemaVersion: 1,
    id: 'import-me',
    name: { en: 'Import me' },
    description: { en: 'Import test' },
    taskTypes: ['general'],
    sections: [{ id: 'goal', title: { en: 'Goal' }, guidance: { en: 'Goal' } }],
  }
  const first = store.importFrameworks([framework])
  assert.deepEqual(first.imported, ['import-me'])
  assert.throws(() => store.importFrameworks([framework]), /already exists/)
  assert.throws(() => store.importFrameworks([framework], { conflict: 'error' }), /already exists/)
  const skip = store.importFrameworks([framework], { conflict: 'skip' })
  assert.deepEqual(skip.skipped, ['import-me'])
  const replace = store.importFrameworks([{ ...framework, name: { en: 'Replaced' } }], { conflict: 'replace' })
  assert.deepEqual(replace.replaced, ['import-me'])
  assert.equal(store.get('import-me').name.en, 'Replaced')
})

test('framework validation rejects malformed custom sections', () => {
  const base = {
    schemaVersion: 1,
    id: 'bad',
    name: { en: 'Bad' },
    description: { en: 'Bad' },
    taskTypes: ['general'],
    sections: [],
  }
  assert.throws(() => validateFramework(base), /sections cannot be empty/)
  assert.throws(() => validateFramework({ ...base, sections: [{ id: 'goal-a', title: { en: 'A' }, guidance: { en: 'A' } }, { id: 'goal-a', title: { en: 'A' }, guidance: { en: 'A' } }] }), /duplicate id/)
  assert.throws(() => validateFramework({ ...base, sections: [{ id: 'Bad_Id', title: { en: 'A' }, guidance: { en: 'A' } }] }), /invalid/)
})
