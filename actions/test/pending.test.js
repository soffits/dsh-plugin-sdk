import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PENDING_MS, createPending, draftText, sameDraft } from '../src/pending.js'

test('the seeded draft is the item quoted, then the prompt', () => {
  assert.equal(draftText('T\n[Item from S (s)]\nline'), '> T\n> [Item from S (s)]\n> line')
  assert.equal(draftText('T\n[Item from S (s)]', 'Why?'), '> T\n> [Item from S (s)]\n\nWhy?')
})

test('a composer takes only a fresh request whose text is its whole draft, once', () => {
  const pending = createPending()
  const draft = draftText('T\n[Item from S (s)]', 'Why?')
  pending.add({ draft }, 1000)
  assert.equal(pending.take(`${draft} and more`, 1100), undefined, 'something typed after it')
  assert.equal(pending.take(draft.replace('\n\n', '\n'), 1200)?.draft, draft, 'paragraph breaks as the editor projects them')
  assert.equal(pending.take(draft, 1300), undefined, 'converted once')
  pending.add({ draft }, 2000)
  assert.equal(pending.take(draft, 2000 + PENDING_MS), undefined, 'stale')
  assert.equal(pending.size, 0)
})

test('drafts compare by words, not spacing', () => {
  assert.ok(sameDraft('a\n\nb ', 'a\nb'))
  assert.ok(!sameDraft('a b', 'ab'))
})
