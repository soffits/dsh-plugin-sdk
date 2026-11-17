import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayDistance, durationParts, formatAgo, formatDuration, formatRelativeDay, unitParts } from '../src/time.js'

const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

test('a duration keeps its two largest units, rounded down, and the last minute counts seconds', () => {
  assert.deepEqual(durationParts(D + 19 * H + 11 * MIN), [{ unit: 'day', n: 1 }, { unit: 'hour', n: 19 }])
  assert.deepEqual(durationParts(D + 19 * H + 11 * MIN, 3), [{ unit: 'day', n: 1 }, { unit: 'hour', n: 19 }, { unit: 'minute', n: 11 }])
  assert.deepEqual(durationParts(D + 5 * MIN), [{ unit: 'day', n: 1 }, { unit: 'minute', n: 5 }])
  assert.deepEqual(durationParts(45_200), [{ unit: 'second', n: 46 }])
  assert.deepEqual(durationParts(-5), [{ unit: 'second', n: 0 }])
})

test('durations read the language’s own way, CJK without spaces', () => {
  assert.equal(formatDuration(D + 19 * H, 'en'), '1d 19h')
  assert.equal(formatDuration(D + 19 * H, 'zh'), '1天19小时')
  assert.deepEqual(unitParts(19, 'hour', 'en'), { number: '19', unit: 'h' })
  assert.deepEqual(unitParts(1, 'day', 'zh'), { number: '1', unit: '天' })
})

test('days read relative to today, then as dates', () => {
  const now = new Date(2026, 10, 17, 14, 0).getTime()
  assert.equal(formatRelativeDay('2026-11-17', now, 'en'), 'today')
  assert.equal(formatRelativeDay('2026-11-18', now, 'en'), 'tomorrow')
  assert.equal(formatRelativeDay('2026-11-20', now, 'en'), 'in 3 days')
  assert.equal(formatRelativeDay('2026-11-14', now, 'en'), '3 days ago')
  assert.equal(formatRelativeDay('2026-11-18', now, 'zh'), '明天')
  assert.equal(formatRelativeDay('2026-12-25', now, 'en'), 'Dec 25')
  assert.match(formatRelativeDay(new Date(2026, 10, 17, 18, 5).toISOString(), now, 'en'), /^0?6:05\sPM$|^18:05$/)
  assert.equal(dayDistance(new Date(2026, 10, 18, 0, 30).getTime(), new Date(2026, 10, 17, 23, 50).getTime()), 1)
})

test('DSH’s relative-time buckets become words; "now" is left to the caller', () => {
  assert.equal(formatAgo({ unit: 'minutes', n: 5 }, 'en'), '5 min. ago')
  assert.equal(formatAgo({ unit: 'hours', n: 2 }, 'zh'), '2小时前')
  assert.equal(formatAgo({ unit: 'now', n: 0 }, 'en'), null)
})
