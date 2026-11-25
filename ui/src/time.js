/**
 * Time as people read it, in the page's language: durations ("1d 19h"),
 * days relative to today ("tomorrow", "in 3 days"), and how long ago.
 * Pure: every function takes `now` and an Intl locale, so the page decides
 * when to recompute and tests need no clock.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const UNITS = [['day', DAY], ['hour', HOUR], ['minute', MINUTE]]

/**
 * A duration split into days, hours and minutes, largest first, without the
 * empty ones and at most `max` of them; the last kept unit is rounded down.
 * The last minute counts down in seconds.
 */
export function durationParts(ms, max = 2) {
  if (ms < MINUTE) return [{ unit: 'second', n: Math.max(0, Math.ceil(ms / 1000)) }]
  let rest = ms
  const parts = []
  for (const [unit, size] of UNITS) {
    const n = Math.floor(rest / size)
    rest -= n * size
    if (n > 0 || parts.length > 0) parts.push({ unit, n })
  }
  return parts.filter(part => part.n > 0).slice(0, max)
}

/** One unit amount the language's own short way: 1d, 19 h, 19小时, 11 min. */
export function unitText(n, unit, locale, display = 'narrow') {
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: display }).format(n)
}

/** A unit amount as its number and its unit text apart, for a big number with a small unit: `{ number: '19', unit: 'h' }`. */
export function unitParts(n, unit, locale) {
  const parts = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).formatToParts(n)
  return {
    number: parts.filter(part => part.type === 'integer' || part.type === 'group' || part.type === 'decimal' || part.type === 'fraction').map(part => part.value).join(''),
    unit: parts.filter(part => part.type === 'unit').map(part => part.value).join('').trim(),
  }
}

/** "1d 19h", "1天19小时": the parts joined the way the language lists units. */
export function formatDuration(ms, locale, max = 2) {
  const texts = durationParts(ms, max).map(({ n, unit }) => unitText(n, unit, locale))
  return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(texts)
}

const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A date or date-time string as a time; a bare day is local midnight, so it is that day everywhere. */
export function toTime(value) {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return NaN
  const day = DAY_ONLY.exec(value)
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime()
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN
}

/** Whole calendar days from `now`'s day to `time`'s day, in the browser's zone. */
export function dayDistance(time, now) {
  const a = new Date(now)
  const b = new Date(time)
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / DAY)
}

/**
 * A day relative to today: "today", "tomorrow", "in 3 days", "2 days ago";
 * further than `near` days it is the date itself. A date-time today shows its time.
 */
export function formatRelativeDay(value, now, locale, near = 13) {
  const time = toTime(value)
  if (!Number.isFinite(time)) return String(value ?? '')
  const days = dayDistance(time, now)
  if (days === 0 && !DAY_ONLY.test(String(value))) return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(time)
  if (Math.abs(days) <= near) return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day')
  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear()
  return new Intl.DateTimeFormat(locale, sameYear ? { month: 'short', day: 'numeric' } : { dateStyle: 'medium' }).format(time)
}

const BUCKET_UNIT = { minutes: 'minute', hours: 'hour', days: 'day', months: 'month', years: 'year' }

/** DSH's relative-time bucket (`{ unit: 'now' | 'minutes' | …, n }`) as words; null for 'now', which the caller words itself. */
export function formatAgo(bucket, locale) {
  const unit = BUCKET_UNIT[bucket.unit]
  return unit === undefined ? null : new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'short' }).format(-bucket.n, unit)
}

/** A full date and time, for the tooltip beside a relative one. */
export function formatFull(time, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time)
}

/** How often something that shows `ms` left should redraw: every second in the last minute, else every minute. */
export function tickFor(ms) {
  return Math.abs(ms) < 2 * MINUTE ? 1000 : MINUTE
}
