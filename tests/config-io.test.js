import assert from 'node:assert/strict'
import test from 'node:test'

import { createFrameworkStore } from '../src/core/frameworks.js'
import { exportConfiguration, importConfiguration, isConfigurationBundle } from '../src/core/config-io.js'
import { readConfig } from '../src/core/config.js'

test('configuration export contains only preferences and custom frameworks', () => {
  const config = readConfig({ provider: 'fixture', model: 'fixture-model' })
  const store = createFrameworkStore()
  store.register({
    schemaVersion: 1,
    id: 'custom-export',
    name: { en: 'Custom export' },
    description: { en: 'Custom export test' },
    taskTypes: ['general'],
    sections: [{ id: 'goal', title: { en: 'Goal' }, guidance: { en: 'Goal' } }],
  })
  const bundle = exportConfiguration({ config, frameworkStore: store })
  assert.equal(bundle.kind, 'dsh-prompt-weaver.config')
  assert.equal(bundle.frameworks.length, 1)
  assert.equal(bundle.preferences.mode, 'standard')
  assert.equal(bundle.provider, undefined)
  assert.equal(bundle.model, undefined)
  assert.equal(bundle.frameworksFile, undefined)
  assert.equal(isConfigurationBundle(bundle), true)
})

test('configuration import validates and applies conflict policy', () => {
  const store = createFrameworkStore()
  const framework = {
    schemaVersion: 1,
    id: 'imported-config',
    name: { en: 'Imported config' },
    description: { en: 'Imported config test' },
    taskTypes: ['general'],
    sections: [{ id: 'goal', title: { en: 'Goal' }, guidance: { en: 'Goal' } }],
  }
  const report = importConfiguration({
    schemaVersion: 1,
    kind: 'dsh-prompt-weaver.config',
    preferences: { mode: 'strict', defaultFramework: 'general', maxIterations: 3, includeAssistantMessages: true },
    frameworks: [framework],
  }, { frameworkStore: store })
  assert.deepEqual(report.frameworks.imported, ['imported-config'])
  assert.equal(report.preferences.mode, 'strict')
  assert.equal(store.get('imported-config').name.en, 'Imported config')
  assert.throws(() => importConfiguration({
    schemaVersion: 1,
    kind: 'dsh-prompt-weaver.config',
    preferences: {},
    frameworks: [framework],
  }, { frameworkStore: store }), /already exists/)
})

test('configuration import rejects malformed bundles', () => {
  const store = createFrameworkStore()
  assert.throws(() => importConfiguration({ schemaVersion: 2, kind: 'dsh-prompt-weaver.config' }, { frameworkStore: store }), /schemaVersion/)
  assert.throws(() => importConfiguration({ schemaVersion: 1, kind: 'other' }, { frameworkStore: store }), /kind/)
})
