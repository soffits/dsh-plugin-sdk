import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chain, readLocales, tableFor, tables } from '../index.js'

async function folder(files, run) {
  const dir = await mkdtemp(join(tmpdir(), 'host-kit-'))
  try {
    for (const [name, value] of Object.entries(files)) await writeFile(join(dir, name), typeof value === 'string' ? value : JSON.stringify(value))
    return await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('every language file is read; other files are ignored and bad ones skipped with a warning', async () => {
  await folder({
    'en.json': { meta: { title: 'Inbox' }, ui: { title: 'Inbox', count: 3, more: 'More' } },
    'fr.json': { meta: {}, ui: { title: 'Boîte' } },
    'de.json': '{',
    'ja.json': { meta: {} },
    'notes.json': { ui: { title: 'no' } },
    'readme.txt': 'no',
  }, async dir => {
    const warnings = []
    const locales = await readLocales(dir, { warn: message => warnings.push(message) })
    assert.deepEqual(locales, { en: { title: 'Inbox', more: 'More' }, fr: { title: 'Boîte' } })
    assert.equal(warnings.length, 3)
    assert.match(warnings.join('\n'), /de\.json/)
    assert.match(warnings.join('\n'), /notes\.json: the name is not a language tag/)
    assert.match(warnings.join('\n'), /ja\.json: no "ui" table/)
  })
})

test('a missing base language is reported', async () => {
  await folder({ 'fr.json': { ui: { a: 'un' } } }, async dir => {
    const warnings = []
    await readLocales(dir, { warn: message => warnings.push(message) })
    assert.match(warnings[0], /en\.json is missing/)
  })
})

test('the fallback chain goes from the exact tag to the base', () => {
  assert.deepEqual(chain('pt-BR'), ['pt-br', 'pt', 'en'])
  assert.deepEqual(chain('zh-Hant-TW'), ['zh-hant-tw', 'zh-hant', 'zh', 'en'])
  assert.deepEqual(chain('en'), ['en'])
  assert.deepEqual(chain(''), ['en'])
})

const locales = {
  en: { a: 'one', b: 'two', c: 'three' },
  fr: { a: 'un', b: 'deux' },
  'fr-CA': { a: 'un (CA)' },
  'zh-TW': { a: '一' },
}

test('each table is complete: the tag, its primary language, then the base', () => {
  const all = tables(locales)
  assert.deepEqual(all['fr-CA'], { a: 'un (CA)', b: 'deux', c: 'three' })
  assert.deepEqual(all.fr, { a: 'un', b: 'deux', c: 'three' })
  assert.deepEqual(all.zh, { a: '一', b: 'two', c: 'three' }, 'a regional file answers for its primary tag')
  assert.deepEqual(Object.keys(all).sort(), ['en', 'fr', 'fr-CA', 'zh', 'zh-TW'])
})

test('one table for a requested tag, and the tag it came from', () => {
  assert.deepEqual(tableFor(locales, 'fr-CA'), { tag: 'fr-ca', messages: { a: 'un (CA)', b: 'deux', c: 'three' } })
  assert.deepEqual(tableFor(locales, 'fr-BE'), { tag: 'fr', messages: { a: 'un', b: 'deux', c: 'three' } })
  assert.deepEqual(tableFor(locales, 'zh'), { tag: 'zh', messages: { a: '一', b: 'two', c: 'three' } })
  assert.deepEqual(tableFor(locales, 'ja'), { tag: 'en', messages: locales.en })
  assert.deepEqual(tableFor({}, 'ja'), { tag: 'en', messages: {} })
})
