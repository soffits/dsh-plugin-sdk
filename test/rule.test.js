import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemText } from '../src/item.js'
import { ITEM_NODE, itemRule } from '../src/rule.js'

const quote = text => text.split('\n').map(line => `> ${line}`).join('\n')
const item = quote(itemText({ source: '@x/board', sourceName: 'Board', title: 'Fix the bike', lines: ['Chores'] }))

/** Every candidate the rule offers, walking forward the way DSH's evaluator does. */
function walk(text) {
  const out = []
  let from = 0
  for (;;) {
    const hit = itemRule.match(text, from)
    if (hit === undefined) return out
    out.push(hit)
    from = hit.end
  }
}

test('the card comes before DSH\'s own quote rule and the blank lines around it become line breaks', () => {
  assert.ok(itemRule.order < -10)
  const text = `Before\n\n${item}\n\nWhat first?`
  const hits = walk(text)
  assert.deepEqual(hits.map(hit => [hit.id, text.slice(hit.start, hit.end), hit.data.display]), [
    ['text', '\n\n', '\n'],
    [ITEM_NODE, item, undefined],
    ['text', '\n\n', '\n'],
  ])
  assert.equal(hits[1].data.title, 'Fix the bike')
})

test('a message with no items offers nothing; a plain quote is left to DSH', () => {
  assert.deepEqual(walk('hello\n\n> a quote\n\nbye'), [])
})

test('two items in a row', () => {
  const text = `${item}\n\n${item}\nok`
  assert.deepEqual(walk(text).map(hit => hit.id), [ITEM_NODE, 'text', ITEM_NODE, 'text'])
})
