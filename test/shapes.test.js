import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TAG_TONE, TONES, share, sparkPath, tagTone, toneColor } from '../src/shapes.js'

test('every tone has a theme colour and a DSH Tag palette', () => {
  for (const tone of TONES) {
    assert.match(toneColor(tone), /^var\(--dsw-alias-/)
    assert.ok(['success', 'warning', 'danger', 'info', 'neutral'].includes(TAG_TONE[tone]))
  }
  assert.equal(tagTone('nonsense'), 'neutral')
  assert.equal(toneColor('nonsense'), toneColor('muted'))
})

test('a sparkline spans its box, breaks at gaps and ends at the last value', () => {
  const { line, area, last } = sparkPath([0, 10, null, 5], 100, 20, { pad: 0 })
  assert.equal(line, 'M0.0 20.0L33.3 0.0M100.0 10.0')
  assert.equal((area.match(/Z/g) ?? []).length, 2)
  assert.deepEqual(last, [100, 10])
  assert.equal(sparkPath([], 100, 20).last, null)
  assert.equal(sparkPath([3, 3], 10, 10, { pad: 0 }).line, 'M0.0 10.0L10.0 10.0')
})

test('share stays inside 0..1', () => {
  assert.equal(share(5, 10), 0.5)
  assert.equal(share(15, 10), 1)
  assert.equal(share(5, 0), 0)
})
