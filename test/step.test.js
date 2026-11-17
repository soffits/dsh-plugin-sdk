import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseItem, itemRanges, stepMessage } from '../src/item.js'
import { pickText } from '../src/text.js'
import { recentWorkspace } from '../src/workspace.js'

test('text maps show the person\'s language, then its primary tag, then en, then the first', () => {
  const label = { en: 'Pay it', zh: '去付款', 'pt-br': 'Pagar' }
  assert.equal(pickText(label, 'zh'), '去付款')
  assert.equal(pickText(label, 'zh-CN'), '去付款')
  assert.equal(pickText(label, 'pt'), 'Pagar')
  assert.equal(pickText(label, 'fr'), 'Pay it')
  assert.equal(pickText({ de: 'Zahlen' }, 'fr'), 'Zahlen')
  assert.equal(pickText('Pay it', 'zh'), 'Pay it')
  assert.equal(pickText(undefined, 'en'), '')
})

test('a step sends the instruction first, then the item, which still reads back', () => {
  const text = stepMessage('Pay the invoice today', { source: '@x/inbox', sourceName: 'Inbox', title: 'Invoice ready', lines: ['Due Friday'], context: { record: 'r1' } })
  assert.equal(text, 'Pay the invoice today\n\n> Invoice ready\n> [Item from Inbox (@x/inbox)]\n> Due Friday\n> context: {"record":"r1"}')
  const [range] = itemRanges(text)
  assert.equal(range.item.title, 'Invoice ready')
  assert.deepEqual(parseItem(text.slice(range.start, range.end).replace(/^> /gm, '')).context, { record: 'r1' })
})

test('a new step goes to the workspace with the most recent activity, else the newest workspace', () => {
  const workspaces = { items: [
    { workspaceId: 'w1', sessionIds: ['a', 'b'], createdAt: '2026-01-01T00:00:00Z' },
    { workspaceId: 'w2', sessionIds: ['c'], createdAt: '2026-01-02T00:00:00Z' },
    { workspaceId: 'w3', sessionIds: [], createdAt: '2026-01-03T00:00:00Z' },
  ] }
  assert.equal(recentWorkspace(workspaces, { a: { updatedAt: 10 }, b: { updatedAt: Date.parse('2027-01-01') }, c: { updatedAt: 20 } }), 'w1')
  assert.equal(recentWorkspace(workspaces, {}), 'w3')
  assert.equal(recentWorkspace({ items: [] }, {}), undefined)
})
