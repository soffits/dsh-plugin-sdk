/**
 * Builds client.js, the Web client in DSH's module-loader format, from
 * src/client/, every locale/<tag>.json and the Lucide icons named in
 * src/icons.txt (a client bundle can't read package files at runtime, so
 * words and icons are bundled; a new language is a new file). Also writes
 * icons.json, the names of the bundled icons, for producers that want to check one.
 * client.js and icons.json are committed so a linked checkout runs as it is;
 * `--check` fails when either is stale.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lucide = dirname(createRequire(import.meta.url).resolve('lucide-static/package.json'))

/** The names in src/icons.txt, in order. */
function iconNames() {
  return readFileSync(resolve(root, 'src/icons.txt'), 'utf8').split('\n')
    .filter(line => !line.startsWith('#')).flatMap(line => line.trim().split(/\s+/)).filter(Boolean)
}

const camel = name => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

/** One Lucide SVG as `[[tag, attributes], …]` (its shapes; the frame is the same for all of them). */
function shapes(name) {
  let svg
  try {
    svg = readFileSync(join(lucide, 'icons', `${name}.svg`), 'utf8')
  } catch {
    throw new Error(`src/icons.txt names ${name}, which lucide-static ${lucideVersion()} doesn't have`)
  }
  const body = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')
  return [...body.matchAll(/<(\w+)([^>]*?)\/?>/g)].map(([, tag, attrs]) =>
    [tag, Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [camel(key), value]))])
}

function lucideVersion() {
  return JSON.parse(readFileSync(join(lucide, 'package.json'), 'utf8')).version
}

function iconTable() {
  const names = iconNames()
  const repeated = names.filter((name, i) => names.indexOf(name) !== i)
  if (repeated.length > 0) throw new Error(`src/icons.txt repeats ${repeated.join(', ')}`)
  return Object.fromEntries(names.map(name => [name, shapes(name)]))
}

const icons = iconTable()

const virtual = {
  name: 'virtual',
  setup(b) {
    b.onResolve({ filter: /^virtual:(locales|icons)$/ }, args => ({ path: args.path.slice(8), namespace: 'virtual' }))
    b.onLoad({ filter: /^locales$/, namespace: 'virtual' }, () => {
      const dir = resolve(root, 'locale')
      const files = readdirSync(dir).filter(name => name.endsWith('.json')).sort()
      const table = Object.fromEntries(files.map(name => [name.slice(0, -5), JSON.parse(readFileSync(resolve(dir, name), 'utf8'))]))
      return { contents: `export default ${JSON.stringify(table)}`, loader: 'js' }
    })
    b.onLoad({ filter: /^icons$/, namespace: 'virtual' }, () => ({ contents: `export default ${JSON.stringify(icons)}`, loader: 'js' }))
  },
}

const result = await build({
  entryPoints: [resolve(root, 'src/client/index.js')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  // Both come from the page's shared module table, so every plugin uses the same React and the same DSH components.
  external: ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  plugins: [virtual],
  legalComments: 'none',
  logLevel: 'warning',
})

// DSH runs client scripts as classic scripts in one global scope: everything stays inside the factory.
const body = result.outputFiles[0].text
const outputs = {
  'client.js': `/* ${pkg.name} ${pkg.version}: built by scripts/build.mjs from src/client/, locale/ and Lucide ${lucideVersion()} (ISC; see LICENSE-lucide). Do not edit. */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
${body}
    return module.exports
  },
})
`,
  'icons.json': `${JSON.stringify({ lucide: lucideVersion(), names: Object.keys(icons) }, null, 1)}\n`,
}

let stale = false
for (const [file, text] of Object.entries(outputs)) {
  const target = resolve(root, file)
  if (process.argv.includes('--check')) {
    let current = ''
    try { current = readFileSync(target, 'utf8') } catch {}
    if (current !== text) { console.error(`${file} is stale: run npm run build`); stale = true }
  } else {
    writeFileSync(target, text)
  }
}
if (stale) process.exit(1)
