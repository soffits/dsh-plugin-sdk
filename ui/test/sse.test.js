import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backoff, createSseParser } from '../src/sse.js'

test('the parser joins data lines, skips comments and other fields, and copes with any chunking', () => {
  const got = []
  const parser = createSseParser(data => got.push(data))
  const stream = ': connected\n\ndata: {"a":1}\n\nevent: x\nid: 7\ndata: one\ndata:two\r\n\r\n: heartbeat\n\n'
  for (const char of stream) parser.feed(char)
  assert.deepEqual(got, ['{"a":1}', 'one\ntwo'])
})

test('reconnects wait longer each time, up to half a minute', () => {
  assert.equal(backoff(0, () => 0.5), 1)
  assert.equal(backoff(3, () => 0.5), 8)
  assert.equal(backoff(20, () => 0.5), 30)
  assert.ok(backoff(1, () => 0) >= 1.6 && backoff(1, () => 1) < 2.41)
})
