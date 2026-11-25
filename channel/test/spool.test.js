import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createSpool, enqueue, waitForResult, withdraw } from '../src/spool.js'

test('a spooled request is handled once and its result read back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  let spool
  try {
    const handled = []
    let ready = false
    spool = createSpool({ dir, handle: async (request) => { handled.push(request.text); if (request.text === 'bad') throw new Error('refused'); return { n: handled.length } }, ready: () => ready, onError: assert.fail, intervalMs: 20 })
    const first = await enqueue({ text: 'ok' }, dir)
    const second = await enqueue({ text: 'bad' }, dir)
    await spool.start()
    await spool.drain()
    assert.deepEqual(handled, [], 'nothing is handled before the bridge is ready')
    ready = true
    assert.deepEqual(await waitForResult(first, 2000, dir), { ok: true, result: { n: 1 } })
    assert.deepEqual(await waitForResult(second, 2000, dir), { ok: false, error: 'refused' })
    assert.equal(await waitForResult('missing', 50, dir), undefined)
    spool.stop()
    assert.deepEqual(handled, ['ok', 'bad'])
    assert.deepEqual(await readdir(dir), [], 'a request is settled before its result shows, and results are removed once read')
  } finally {
    spool?.stop()
    await rm(dir, { recursive: true, force: true })
  }
})

test('a request being handled when the Host stopped is handled again at start; a waiting one can be withdrawn', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  try {
    await writeFile(join(dir, '1-a.processing'), JSON.stringify({ text: 'again' }))
    const waiting = await enqueue({ text: 'never' }, dir)
    assert.equal(await withdraw(waiting, dir), true)
    assert.equal(await withdraw(waiting, dir), false)
    const handled = []
    const spool = createSpool({ dir, handle: async (request) => handled.push(request.text), ready: () => true, onError: assert.fail })
    await spool.start()
    await spool.drain()
    spool.stop()
    assert.deepEqual(handled, ['again'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a spool stopped while starting does not keep running', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'spool-'))
  try {
    const handled = []
    const spool = createSpool({ dir, handle: async (request) => handled.push(request.text), ready: () => true, onError: assert.fail, intervalMs: 10 })
    const starting = spool.start()
    spool.stop()
    await starting
    await enqueue({ text: 'x' }, dir)
    await new Promise((resolve) => setTimeout(resolve, 80))
    spool.stop()
    assert.deepEqual(handled, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
