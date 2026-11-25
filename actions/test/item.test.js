import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONTEXT_MAX, MAX_LINES, itemRanges, itemSummary, itemText, parseItem } from '../src/item.js'

const about = { source: '@soffits/dsh-card-board', sourceName: 'Card board', title: 'Fix the bike', lines: ['Chores · due Fri', 'Tyre is flat'], context: { board: 'home', card: 'chores' } }

test('an item is a fixed header, its lines and one line of context JSON, and reads back the same', () => {
  const text = itemText(about)
  assert.equal(text, 'Fix the bike\n[Item from Card board (@soffits/dsh-card-board)]\nChores · due Fri\nTyre is flat\ncontext: {"board":"home","card":"chores"}')
  assert.deepEqual(parseItem(text), about)
})

test('values become one line each; names with brackets or parentheses still read back', () => {
  const text = itemText({ source: '@x/y', sourceName: 'Board [beta] (new)', title: 'A\nB  (C)] D', lines: ['one\ntwo', '', '  '] })
  const item = parseItem(text)
  assert.equal(item.sourceName, 'Board [beta) (new)')
  assert.equal(item.source, '@x/y')
  assert.equal(item.title, 'A B (C)] D')
  assert.deepEqual(item.lines, ['one two'])
})

test('limits: at most the line cap, CJK and emoji cut whole, oversized context left out', () => {
  const many = itemText({ source: 's', sourceName: 'S', title: '标题'.repeat(200), lines: Array.from({ length: 40 }, (_, i) => `l${i}`), context: { big: 'x'.repeat(CONTEXT_MAX) } })
  const item = parseItem(many)
  assert.equal(item.lines.length, MAX_LINES)
  assert.equal(item.context, undefined)
  assert.ok(Array.from(item.title).length <= 200 && item.title.endsWith('…'))
  assert.ok(!/[\uD800-\uDBFF]$/u.test(itemText({ source: 's', sourceName: 'S', title: '😀'.repeat(300) }).split('\n')[0].slice(0, -1)))
})

test('a last line that only looks like context stays a line', () => {
  assert.deepEqual(parseItem('T\n[Item from S (s)]\ncontext: not json').lines, ['context: not json'])
})

test('items are found among other quotes and text, ordinary quotes are not items', () => {
  const quoted = itemText(about).split('\n').map(line => `> ${line}`).join('\n')
  const message = `> just a quote\n\n${quoted}\n\nWhat should I do first?`
  const ranges = itemRanges(message)
  assert.equal(ranges.length, 1)
  assert.equal(message.slice(ranges[0].start, ranges[0].end), quoted)
  assert.equal(ranges[0].item.title, 'Fix the bike')
})

test('the composer summary: title inline with the lines, source in the popover', () => {
  assert.deepEqual(itemSummary(about), { label: 'Fix the bike', title: 'Fix the bike', detail: 'Card board', body: 'Chores · due Fri\nTyre is flat' })
})
