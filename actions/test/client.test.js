import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const locales = Object.fromEntries(readdirSync(new URL('../locale/', import.meta.url)).filter(name => name.endsWith('.json')).map(name => [name.slice(0, -5), JSON.parse(read(`../locale/${name}`))]))
const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()

function load() {
  let registration
  const window = { __ModuleLoader__: { load: value => { registration = value } } }
  vm.runInNewContext(read('../client.js'), { window, console })
  const react = { createElement: () => null, useState: () => [], useEffect: () => {}, useRef: () => ({}), useLayoutEffect: () => {}, useCallback: f => f, useSyncExternalStore: () => 0 }
  return { registration, exports: registration.factory(id => { assert.equal(id, 'react'); return react }) }
}

test('the built part registers under its SDK id as a plugin with name, inject and apply', () => {
  const { registration, exports } = load()
  assert.equal(registration.id, '@soffits/dsh-plugin-sdk/actions')
  assert.equal(exports.name, 'ui-actions')
  assert.deepEqual([...exports.inject], ['slots', 'locale'])
  assert.equal(typeof exports.apply, 'function')
})

test('every language file has every key of en with the same placeholders, and every word the code asks for exists', () => {
  const base = locales.en.ui
  for (const [tag, file] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(file.meta).sort(), ['description', 'title'], `${tag} meta`)
    for (const [key, text] of Object.entries(base)) {
      assert.equal(typeof file.ui[key], 'string', `${tag} lacks ${key}`)
      assert.deepEqual(placeholders(file.ui[key]), placeholders(text), `${tag} ${key}`)
    }
  }
  const source = ['bar.js', 'chat.js'].map(name => read(`../src/client/${name}`)).join('\n')
  for (const [, key] of source.matchAll(/\bt\('(\w+)'/g)) assert.equal(typeof base[key], 'string', key)
  for (const kind of ['chat', 'done', 'snooze', 'event', 'link']) assert.equal(typeof base[kind], 'string', kind)
})

test('apply provides the service, registers the item rule, the card and the composer member, and the words of every file', () => {
  const { exports } = load()
  const calls = { provided: {}, slots: [], words: [], rules: [] }
  const effects = []
  const ctx = {
    effect: fn => effects.push(fn),
    locale: { register: (ns, tag) => { calls.words.push(tag); return () => {} }, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'en' }) },
    provide: (name, value) => { calls.provided[name] = value },
    inject: (names, fn) => fn({ effect: f => f(), uiConversation: { userText: { register: rule => calls.rules.push(rule.id) } } }),
    slots: { inject: (name, fn) => fn(), register: options => { calls.slots.push(options.name); return () => {} } },
    get: () => undefined,
  }
  exports.apply(ctx)
  for (const fn of effects) fn()
  assert.deepEqual(Object.keys(calls.provided.uiActions).sort(), ['ActionBar', 'ActionButton', 'chat', 'registerSource', 'start'])
  assert.deepEqual(calls.rules, ['ui-actions-item'])
  assert.deepEqual(calls.slots.sort(), ['conversation.input.dock', 'conversation.user.text.node'])
  assert.deepEqual(calls.words.sort(), Object.keys(locales).sort())
})
