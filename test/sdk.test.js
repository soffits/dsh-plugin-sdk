import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { buildClient, PARTS } from '../scripts/build-client.js'
import { name } from '../index.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('package, Host name, patch row and browser module agree, and every listed file exists', () => {
  assert.equal(name, pkg.name)
  assert.match(read('cordis.patch.yml'), new RegExp(`name: '${pkg.name}'`))
  for (const file of pkg.files.filter(entry => !entry.includes('*'))) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file)
  for (const target of Object.values(pkg.exports).filter(entry => !entry.includes('*'))) assert.ok(existsSync(new URL(`../${target}`, import.meta.url)), target)
})

test('client.js is the join of the current parts', () => {
  assert.equal(read('client.js'), buildClient())
})

test('the browser half starts every part, so the page gets both services', () => {
  let registration
  new Function('window', read('client.js'))({ __ModuleLoader__: { load: entry => { registration = entry } } })
  assert.equal(registration.id, pkg.name)
  const plugin = registration.factory(spec => new Proxy({}, { get: () => () => null }))
  const started = []
  plugin.apply({ plugin: part => started.push(part.name) })
  assert.deepEqual(started, ['ui-actions', 'ui-kit'])
  assert.equal(PARTS.length, started.length)
})
