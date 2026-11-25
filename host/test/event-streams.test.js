import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEventStreams } from '../index.js'

const reader = response => response.body.pipeThrough(new TextDecoderStream()).getReader()

test('a stream opens, carries data events and stops its source when the page goes', async () => {
  const streams = createEventStreams({ headers: { 'x-frame-options': 'DENY' } })
  const abort = new AbortController()
  let send
  let stopped = 0
  const response = streams.respond({ signal: abort.signal }, stream => {
    send = stream.send
    return () => { stopped++ }
  })
  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8')
  assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-transform')
  assert.equal(response.headers.get('x-frame-options'), 'DENY')
  const read = reader(response)
  assert.equal((await read.read()).value, 'retry: 5000\n: open\n\n')
  send({ type: 'change', what: ['shelf'] })
  assert.equal((await read.read()).value, 'data: {"type":"change","what":["shelf"]}\n\n')
  abort.abort()
  assert.equal((await read.read()).done, true)
  assert.equal(stopped, 1)
  send({ late: true })
})

test('close() ends every open stream and stops each source once', async () => {
  const streams = createEventStreams({ heartbeatMs: 10 })
  let stopped = 0
  const reads = [1, 2].map(() => reader(streams.respond({}, () => () => { stopped++ })))
  for (const read of reads) await read.read()
  assert.match((await reads[0].read()).value, /^: beat/)
  streams.close()
  for (const read of reads) {
    let next
    do next = await read.read(); while (!next.done)
  }
  assert.equal(stopped, 2)
})

test('the route can end its own stream; a source set up after the end is stopped at once', async () => {
  const streams = createEventStreams()
  let stopped = 0
  const read = reader(streams.respond({}, async ({ send, end }) => {
    send({ type: 'gone' })
    end()
    await null
    return () => { stopped++ }
  }))
  assert.equal((await read.read()).value, 'retry: 5000\n: open\n\n')
  assert.equal((await read.read()).value, 'data: {"type":"gone"}\n\n')
  assert.equal((await read.read()).done, true)
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(stopped, 1)
})

test('cancelling the reader stops the source; an already aborted request opens nothing', async () => {
  const streams = createEventStreams()
  let stopped = 0
  const read = reader(streams.respond({}, () => () => { stopped++ }))
  await read.read()
  await read.cancel()
  await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal(stopped, 1, 'the cancel travels back through the pipe')
  let started = false
  const aborted = reader(streams.respond({ signal: AbortSignal.abort() }, () => { started = true }))
  assert.equal((await aborted.read()).done, true)
  assert.equal(started, false)
})
