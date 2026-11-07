import assert from 'node:assert/strict'
import test from 'node:test'

import { containsHighConfidenceSecret, redactSecrets, scanSecrets } from '../src/core/privacy.js'

test('redaction masks credential assignments without exposing the secret', () => {
  const text = 'api_key = sk-abcdef1234567890abcdef and password: hunter2hunter2'
  const result = redactSecrets(text)
  assert.match(result.text, /\[REDACTED:/u)
  assert.equal(result.text.includes('sk-abcdef1234567890abcdef'), false)
  assert.equal(result.text.includes('hunter2hunter2'), false)
  assert.ok(result.redactions.length >= 2)
  assert.equal(result.redactions.some(redaction => 'value' in redaction), false)
})

test('private keys and cloud access keys are detected', () => {
  assert.equal(containsHighConfidenceSecret('-----BEGIN RSA PRIVATE KEY-----'), true)
  assert.equal(containsHighConfidenceSecret('AKIAABCDEFGHIJKLMNOP'), true)
  assert.equal(containsHighConfidenceSecret('just a normal prompt'), false)
})

test('scanner reports offsets only', () => {
  const text = 'token: abcdefghijklmnopqrstuvwxyz'
  const findings = scanSecrets(text)
  assert.equal(findings.length, 1)
  assert.equal(findings[0].start, 0)
  assert.equal(findings[0].end, 'token: abcdefghijklmnopqrstuvwxyz'.length)
  assert.equal(Object.values(findings[0]).includes('abcdefghijklmnopqrstuvwxyz'), false)
})
