/**
 * The UserText rule that draws items in sent messages (DSH ui-conversation
 * `UserTextRule`). An item quote becomes one `ui-actions-item` node; the blank
 * line DSH puts after a quote becomes a line break, so the card sits above the
 * person's words in a message and stays inline in one-line previews. Ordered
 * before DSH's own quote rule (-10), which takes every other blockquote.
 */
import { itemRanges } from './item.js'

export const ITEM_NODE = 'ui-actions-item'

/** Item ranges per text: the evaluator asks once per offset, the scan is per text. */
const cache = new Map()
function rangesOf(text) {
  let ranges = cache.get(text)
  if (ranges === undefined) {
    ranges = itemRanges(text)
    if (cache.size > 200) cache.clear()
    cache.set(text, ranges)
  }
  return ranges
}

export const itemRule = {
  id: ITEM_NODE,
  order: -20,
  match(text, from) {
    for (const range of rangesOf(text)) {
      const lead = text.slice(0, range.start).match(/\r?\n(?:[ \t]*\r?\n)*$/u)?.[0]
      if (lead && range.start - lead.length >= from) return { id: 'text', start: range.start - lead.length, end: range.start, data: { text: lead, display: '\n' } }
      if (range.start >= from) return { id: ITEM_NODE, start: range.start, end: range.end, data: range.item }
      const gap = text.slice(range.end).match(/^\r?\n(?:[ \t]*\r?\n)*/u)?.[0]
      if (range.end >= from && gap) return { id: 'text', start: range.end, end: range.end + gap.length, data: { text: gap, display: '\n' } }
    }
    return undefined
  },
}
