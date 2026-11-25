import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNotices } from '../index.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('notices close together are one batch of kinds', async () => {
  const notices = createNotices({ settleMs: 20 })
  const heard = []
  notices.listen(what => heard.push(what))
  notices.notify('library')
  notices.notify('library')
  await sleep(5)
  notices.notify('rooms')
  await sleep(40)
  assert.deepEqual(heard, [['library', 'rooms']])
  notices.close()
})

test('batches are spaced: a burst is a leading batch and one more', async () => {
  const notices = createNotices({ spacingMs: 40 })
  const heard = []
  notices.listen(what => heard.push(what))
  notices.notify('library')
  await sleep(10)
  assert.equal(heard.length, 1, 'the first batch leaves at once')
  for (let n = 0; n < 5; n++) { notices.notify('library'); await sleep(5) }
  await sleep(80)
  assert.equal(heard.length, 2)
  notices.close()
})

test('a listener hears only the scopes it accepts, and unscoped notices', async () => {
  const notices = createNotices()
  const ana = []
  const all = []
  notices.listen(what => ana.push(what), scope => scope === 'ana')
  notices.listen(what => all.push(what))
  notices.notify('marks', 'bo')
  await sleep(5)
  assert.deepEqual(ana, [])
  assert.deepEqual(all, [['marks']])
  notices.notify('marks', 'ana')
  notices.notify('live')
  await sleep(5)
  assert.deepEqual(ana, [['marks', 'live']])
  notices.close()
})

test('nothing reaches a listener after it stops, or anyone after close', async () => {
  const notices = createNotices()
  const heard = []
  const stop = notices.listen(what => heard.push(what))
  stop()
  notices.notify('rooms')
  await sleep(5)
  notices.listen(what => heard.push(what))
  notices.notify('rooms')
  notices.close()
  await sleep(5)
  assert.deepEqual(heard, [])
})
