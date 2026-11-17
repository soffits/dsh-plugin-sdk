/**
 * Small measures: a ring, a sparkline and a progress bar, in one look and
 * drawn in data tones.
 */
import { createElement as h, useLayoutEffect, useState } from 'react'
import { share, sparkPath, toneColor } from '../shapes.js'
import { toTime } from '../time.js'

/** A callback ref and its element's content width, kept current as it resizes. */
export function useWidth() {
  const [element, setElement] = useState(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width]
}

/**
 * A ring filled to `value` of `max`, with anything in its middle (a count, "4 of 24").
 * @param {object} props
 * @param {number} props.value
 * @param {number} props.max
 * @param {number} [props.size] - px (default 54)
 * @param {number} [props.stroke] - px (default size / 9)
 * @param {string} [props.tone] - default accent
 * @param {string} [props.label] - what it measures, for screen readers
 */
export function Ring({ value, max, size = 54, stroke, tone = 'accent', label, children }) {
  const width = stroke ?? Math.max(3, Math.round(size / 9))
  const r = (size - width) / 2
  const length = 2 * Math.PI * r
  const centre = size / 2
  return h('span', { className: 'uk-ring', style: { width: size, height: size }, role: label ? 'img' : undefined, 'aria-label': label },
    h('svg', { width: size, height: size, 'aria-hidden': true },
      h('circle', { cx: centre, cy: centre, r, className: 'uk-ringTrack', strokeWidth: width }),
      share(value, max) > 0 && h('circle', {
        cx: centre, cy: centre, r, strokeWidth: width, fill: 'none', stroke: toneColor(tone), strokeLinecap: 'round',
        strokeDasharray: `${(length * share(value, max)).toFixed(2)} ${length.toFixed(2)}`, transform: `rotate(-90 ${centre} ${centre})`,
      })),
    children !== undefined && h('span', { className: 'uk-ringText' }, children))
}

/**
 * A sparkline. Without `width` it fills its box. Null values leave a gap.
 * @param {object} props
 * @param {Array<number | null>} props.values
 * @param {string} [props.tone] - default accent
 * @param {number} [props.height] - px (default 24)
 * @param {number} [props.width] - px; omit to fill the box
 * @param {boolean} [props.area] - shade under the line
 * @param {boolean} [props.dot] - mark the last point (default true)
 * @param {number} [props.min] - fix the scale's bottom
 * @param {number} [props.max] - fix the scale's top
 * @param {string} [props.label] - what it shows, for screen readers
 */
export function Spark({ values, tone = 'accent', height = 24, width, area = false, dot = true, min, max, label }) {
  const [ref, measured] = useWidth()
  const w = width ?? measured
  const color = toneColor(tone)
  const path = sparkPath(values ?? [], w, height, { pad: dot ? 3 : 1.5, min, max })
  return h('span', { ref: width === undefined ? ref : undefined, className: 'uk-spark', style: { height, ...(width === undefined ? {} : { width }) }, role: label ? 'img' : undefined, 'aria-label': label },
    w > 0 && path.last && h('svg', { width: w, height, 'aria-hidden': true },
      area && h('path', { d: path.area, fill: color, fillOpacity: 0.12, stroke: 'none' }),
      h('path', { d: path.line, fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' }),
      dot && h('circle', { cx: path.last[0], cy: path.last[1], r: 2.6, fill: color, className: 'uk-sparkDot' })))
}

/** A bar filled to `part` (0–1), with optional things on either side. */
function Bar({ part, tone, start, end, label }) {
  const bar = h('span', { className: 'uk-progressTrack', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(part * 100) },
    h('span', { className: 'uk-progressFill', style: { width: `${(part * 100).toFixed(1)}%`, background: toneColor(tone) } }))
  if (start === undefined && end === undefined) return h('span', { className: 'uk-progress' }, bar)
  return h('span', { className: 'uk-progress uk-progressLabelled' },
    start !== undefined && h('span', { className: 'uk-progressLabel' }, start), bar,
    end !== undefined && h('span', { className: 'uk-progressLabel' }, end))
}

export function createProgress({ useNow }) {
  function TimedBar({ from, to, ...rest }) {
    const now = useNow(60_000)
    return h(Bar, { ...rest, part: share(now - toTime(from), toTime(to) - toTime(from)) })
  }

  /**
   * A bar filled to `value` of `max`, or through time from `from` to `to` (ISO), ticking.
   * `start` and `end` sit on either side of the bar (text, or a node such as a TimeUntil).
   * @param {object} props
   * @param {number} [props.value]
   * @param {number} [props.max]
   * @param {string} [props.from]
   * @param {string} [props.to]
   * @param {string} [props.tone] - default accent
   * @param {*} [props.start]
   * @param {*} [props.end]
   * @param {string} [props.label] - what it measures, for screen readers
   */
  function Progress({ value, max, from, to, tone = 'accent', start, end, label }) {
    if (from !== undefined && to !== undefined) return h(TimedBar, { from, to, tone, start, end, label })
    return h(Bar, { part: share(value, max), tone, start, end, label })
  }
  return { Progress }
}
