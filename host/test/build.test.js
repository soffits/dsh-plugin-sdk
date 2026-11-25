import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildClient, localeFiles } from '../build.js'

test('client.js registers under the package name, takes data in, and --check spots a stale output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'host-kit-'))
  try {
    await mkdir(join(root, 'src/client'), { recursive: true })
    await mkdir(join(root, 'locale'))
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: '@example/plugin', version: '1.2.3' }))
    await writeFile(join(root, 'locale/en.json'), JSON.stringify({ ui: { hi: 'Hello' } }))
    await writeFile(join(root, 'src/client/index.js'), "import React from 'react'\nimport words from 'virtual:locales'\nexport const hi = words.en.ui.hi\nexport const r = React\n")
    const options = { root, data: { locales: () => localeFiles(root) }, extra: { 'names.json': '[]\n' } }
    assert.equal(await buildClient({ ...options, check: false }), true)
    const client = await readFile(join(root, 'client.js'), 'utf8')
    assert.match(client, /^\/\* @example\/plugin 1\.2\.3: built from src\/client\/\. Do not edit\. \*\//)
    assert.match(client, /id: "@example\/plugin"/)
    assert.match(client, /"Hello"/)
    assert.match(client, /require\("react"\)/)
    let loaded
    new Function('window', client)({ __ModuleLoader__: { load: spec => { loaded = spec } } })
    assert.equal(loaded.id, '@example/plugin')
    assert.equal(loaded.factory(() => ({})).hi, 'Hello')
    assert.equal(await readFile(join(root, 'names.json'), 'utf8'), '[]\n')
    assert.equal(await buildClient({ ...options, check: true }), true)
    assert.equal(await buildClient({ ...options, id: '@example/pages/part', check: false }), true)
    const part = await readFile(join(root, 'client.js'), 'utf8')
    assert.match(part, /^\/\* @example\/pages\/part: built from/)
    assert.match(part, /id: "@example\/pages\/part"/)
    await buildClient({ ...options, check: false })
    await writeFile(join(root, 'locale/en.json'), JSON.stringify({ ui: { hi: 'Hi' } }))
    const errors = console.error
    console.error = () => {}
    try {
      assert.equal(await buildClient({ ...options, check: true }), false)
    } finally {
      console.error = errors
      process.exitCode = 0
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
