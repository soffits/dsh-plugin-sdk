/**
 * Build a plugin's `client.js`, its Web UI half, in DSH's module-loader format. DSH runs client
 * scripts as classic scripts in one global scope, so the bundle stays inside a factory registered
 * under the package's npm name (the id DSH looks the plugin up by). React and DSH's own components
 * come from the page's shared module table, so they stay outside the bundle.
 *
 * The outputs are committed so a linked checkout runs as it is; with `check` nothing is written and
 * the build fails when a committed output is stale.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * `{ <tag>: <file contents> }` for every `<tag>.json` in a plugin's `locale/` folder, for a bundle
 * that needs its words built in (a client bundle can't read package files at run time).
 * @param {string} root
 */
export function localeFiles(root) {
  const dir = join(root, 'locale')
  return Object.fromEntries(readdirSync(dir).filter(name => name.endsWith('.json')).sort()
    .map(name => [name.slice(0, -'.json'.length), JSON.parse(readFileSync(join(dir, name), 'utf8'))]))
}

/**
 * @param {object} options
 * @param {string} options.root - the plugin's folder (its package.json names the module)
 * @param {string} [options.id] - the module id, for a part of a package that has no package.json of its own
 * @param {string} [options.entry] - relative to `root`
 * @param {string[]} [options.external] - modules the page's shared module table provides
 * @param {Record<string, () => unknown>} [options.data] - `import x from 'virtual:<name>'` gives the
 *   value the function returns, built in as JSON
 * @param {string} [options.from] - what the header says it was built from
 * @param {Record<string, string>} [options.extra] - more committed outputs: file name → contents
 * @param {boolean} [options.check] - compare instead of writing (default: `--check` on the command line)
 * @returns {Promise<boolean>} whether every output was current (always true when writing)
 */
export async function buildClient({
  root,
  id,
  entry = 'src/client/index.js',
  external = ['react', '@deepseek-ai/dsh-client-ui-primitives'],
  data = {},
  from = 'src/client/',
  extra = {},
  check = process.argv.includes('--check'),
}) {
  const { build } = await import('esbuild')
  const pkg = id === undefined ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) : undefined
  const name = id ?? pkg.name
  const label = pkg === undefined ? name : `${pkg.name} ${pkg.version}`
  const virtual = {
    name: 'virtual',
    setup(b) {
      b.onResolve({ filter: /^virtual:/ }, args => {
        const name = args.path.slice('virtual:'.length)
        if (!Object.hasOwn(data, name)) return { errors: [{ text: `no data named ${name}` }] }
        return { path: name, namespace: 'virtual' }
      })
      b.onLoad({ filter: /.*/, namespace: 'virtual' }, args => ({ contents: `export default ${JSON.stringify(data[args.path]())}`, loader: 'js' }))
    },
  }
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    external,
    plugins: [virtual],
    legalComments: 'none',
    logLevel: 'warning',
  })
  const outputs = {
    'client.js': `/* ${label}: built from ${from}. Do not edit. */
window.__ModuleLoader__.load({
  id: ${JSON.stringify(name)},
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
${result.outputFiles[0].text}
    return module.exports
  },
})
`,
    ...extra,
  }
  let current = true
  for (const [file, text] of Object.entries(outputs)) {
    const target = join(root, file)
    if (!check) {
      writeFileSync(target, text)
      continue
    }
    let committed = ''
    try {
      committed = readFileSync(target, 'utf8')
    } catch {
      // Not built yet: stale.
    }
    if (committed !== text) {
      console.error(`${file} is stale: run npm run build`)
      current = false
    }
  }
  if (!current) process.exitCode = 1
  return current
}
