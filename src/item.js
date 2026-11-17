/**
 * An item a conversation is about, as the text the model reads and the
 * message keeps. One Markdown blockquote (DSH adds the `> ` marks when it
 * sends a quote):
 *
 *   Fix the bike
 *   [Item from Card board (@soffits/dsh-card-board)]
 *   Chores · due Fri
 *   context: {"board":"home","card":"chores"}
 *
 * The title leads, so a session named after its first words reads well; the
 * second line is the fixed, language-neutral marker, with the source name the
 * person saw. Pure, no DOM: the Web client and the tests share it.
 */

/** Longest title, per detail line, in characters (code points, so CJK and emoji cut cleanly). */
export const TITLE_MAX = 200
export const LINE_MAX = 300
/** Most detail lines an item carries. */
export const MAX_LINES = 15
/** Longest `context` JSON; a larger context is left out rather than cut into invalid JSON. */
export const CONTEXT_MAX = 2000

const MARKER = /^\[Item from (.+) \(([^\s()]+)\)\]$/
const CONTEXT = 'context: '

/** One line: whitespace runs (newlines included) become one space, then the length is capped. */
export function oneLine(value, max) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim()
  const chars = Array.from(text)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text
}

/**
 * @param {object} item
 * @param {string} item.source - the offering plugin's package name
 * @param {string} item.sourceName - the plugin's name as the person sees it
 * @param {string} item.title
 * @param {string[]} [item.lines] - what the item shows, one entry per line
 * @param {unknown} [item.context] - small JSON about the item (ids, values shown)
 * @returns {string} the quote text, without `> ` marks
 */
export function itemText({ source, sourceName, title, lines = [], context }) {
  const id = oneLine(source, 120).replace(/[\s()]/gu, '')
  const name = oneLine(sourceName || id, 80).replace(/\]/gu, ')')
  const out = [oneLine(title, TITLE_MAX) || '…', `[Item from ${name} (${id})]`]
  for (const line of lines) {
    if (out.length > MAX_LINES + 1) break
    const text = oneLine(line, LINE_MAX)
    if (text !== '') out.push(text)
  }
  if (context !== undefined && context !== null) {
    const json = JSON.stringify(context)
    if (json !== undefined && json.length <= CONTEXT_MAX) out.push(`${CONTEXT}${json}`)
  }
  return out.join('\n')
}

/**
 * Read an item back from quote text (the lines without `> ` marks).
 * @returns {{ source: string, sourceName: string, title: string, lines: string[], context?: unknown } | null}
 */
export function parseItem(text) {
  const rows = String(text).replace(/\r\n?/gu, '\n').split('\n')
  const marker = MARKER.exec(rows[1] ?? '')
  if (marker === null || (rows[0] ?? '').trim() === '') return null
  const lines = rows.slice(2).filter(line => line.trim() !== '')
  const item = { source: marker[2], sourceName: marker[1], title: rows[0].trim(), lines }
  const last = lines[lines.length - 1]
  if (last?.startsWith(CONTEXT)) {
    try {
      item.context = JSON.parse(last.slice(CONTEXT.length))
      lines.pop()
    } catch {
      // not ours: an ordinary detail line that happens to start with "context: "
    }
  }
  return item
}

/** The quote text without its `> ` marks (up to three leading spaces, as Markdown allows). */
const unquote = text => text.replace(/\r\n?/gu, '\n').replace(/^ {0,3}>[ \t]?/gmu, '')

/**
 * Items quoted in a message: each run of blockquote lines whose text is an item.
 * @param {string} text - the whole message
 * @returns {{ start: number, end: number, item: object }[]} UTF-16 spans, without the trailing line break
 */
export function itemRanges(text) {
  const ranges = []
  for (const match of String(text).matchAll(/^ {0,3}>[^\r\n]*(?:\r?\n {0,3}>[^\r\n]*)*/gmu)) {
    const item = parseItem(unquote(match[0]))
    if (item !== null) ranges.push({ start: match.index, end: match.index + match[0].length, item })
  }
  return ranges
}

/**
 * The readable form DSH's composer shows in place of the quote text
 * (ui-primitives `QuoteSummary`): the title inline with the first line, and
 * the source with every line in the popover.
 */
export function itemSummary({ sourceName, title, lines = [] }) {
  const shown = lines.map(line => oneLine(line, LINE_MAX)).filter(Boolean)
  return {
    label: oneLine(title, TITLE_MAX) || '…',
    title: oneLine(title, TITLE_MAX) || '…',
    detail: oneLine(sourceName, 80),
    body: shown.join('\n'),
  }
}
