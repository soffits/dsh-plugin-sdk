import assert from 'node:assert/strict'
import test from 'node:test'
import * as core from '../index.js'

test('every export of the package entry is defined', () => {
  for (const [name, value] of Object.entries(core)) assert.notEqual(value, undefined, name)
  assert.equal(core.SILENT_REPLY, '[SILENT]')
})
