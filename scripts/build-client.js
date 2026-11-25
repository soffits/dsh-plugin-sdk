#!/usr/bin/env node
/**
 * Builds client.js, the SDK's one browser module, from the browser modules of its parts
 * (actions/client.js, then ui/client.js, each built by its own scripts/build.mjs and testable alone).
 * DSH loads one browser module per package, so they are joined here: each part's
 * `window.__ModuleLoader__.load(` becomes a registration, and the SDK's plugin starts every part as a
 * child plugin, which provides its service (`uiActions`, `uiKit`). No other change is made to their text.
 *
 * `node scripts/build-client.js` writes client.js; `--check` exits 1 when client.js is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const LOAD = 'window.__ModuleLoader__.load('
/** The parts with a browser half, in the order they start (ui-kit uses uiActions when it is there). */
export const PARTS = ['actions', 'ui']

/** The text of client.js for the current sources. */
export function buildClient() {
  const name = JSON.parse(read('package.json')).name
  const parts = PARTS.map(part => {
    const source = read(`${part}/client.js`)
    const at = source.indexOf(LOAD)
    if (at === -1 || source.indexOf(LOAD, at + 1) !== -1) throw new Error(`${part}/client.js must call ${LOAD} exactly once`)
    return `// ---- ${part}/client.js\n${source.slice(0, at)}part(${source.slice(at + LOAD.length)}`
  })
  return [
    `/* ${name}: built by scripts/build-client.js from ${PARTS.map(part => `${part}/client.js`).join(' and ')}. Do not edit. */`,
    'window.__ModuleLoader__.load({',
    `  id: ${JSON.stringify(name)},`,
    '  factory(require) {',
    '    const parts = []',
    '    const part = ({ factory }) => { parts.push(factory(require)) }',
    '',
    ...parts,
    '    return {',
    `      name: ${JSON.stringify(name)},`,
    '      inject: [],',
    '      apply(ctx) { for (const plugin of parts) ctx.plugin(plugin) },',
    '    }',
    '  },',
    '})',
    '',
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('client.js', root)
  const next = buildClient()
  if (process.argv.includes('--check')) {
    let current = ''
    try { current = readFileSync(target, 'utf8') } catch { /* missing counts as out of date */ }
    if (current !== next) {
      console.error('client.js is out of date: run npm run build')
      process.exit(1)
    }
  } else {
    writeFileSync(target, next)
  }
}
