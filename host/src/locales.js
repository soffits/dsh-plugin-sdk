/**
 * A plugin's words: one `locale/<tag>.json` per language, `{ meta, ui }` (`meta` is DSH's plugin title
 * and description, `ui` the page's words). Which languages exist is whatever files are there, so a new
 * language is a new file and no code names one. A missing word comes from the primary language
 * (`zh` for `zh-TW`), then from the base language.
 *
 * Read the folder on every request rather than once at start: DSH swaps a plugin's browser half as soon
 * as its files change, before the host half reloads, so words kept from start would hand a freshly
 * updated page the old table.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The language every lookup ends at. */
export const BASE = 'en'

/** A language tag as DSH accepts it (`en`, `pt-BR`, `zh-Hant-TW`). */
export const TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

/**
 * `{ <tag>: { <key>: text } }` from each `<tag>.json` in `dir` (its `ui` table, text values only).
 * Files not ending in `.json` are ignored; a `.json` file that isn't named by a language tag, isn't
 * JSON or has no `ui` table is skipped and reported, so one bad file doesn't take every language down.
 *
 * @param {string} dir
 * @param {{ warn?: (message: string) => void }} [options]
 */
export async function readLocales(dir, { warn = () => {} } = {}) {
  const locales = {}
  for (const name of (await readdir(dir)).filter(file => file.endsWith('.json')).sort()) {
    const tag = name.slice(0, -'.json'.length)
    if (!TAG.test(tag)) {
      warn(`locale/${name}: the name is not a language tag; skipped`)
      continue
    }
    try {
      const { ui } = JSON.parse(await readFile(join(dir, name), 'utf8'))
      if (ui === null || typeof ui !== 'object' || Array.isArray(ui)) throw new Error('no "ui" table')
      locales[tag] = Object.fromEntries(Object.entries(ui).filter(([, text]) => typeof text === 'string'))
    } catch (error) {
      warn(`locale/${name}: ${error.message}; skipped`)
    }
  }
  if (locales[BASE] === undefined) warn(`locale/${BASE}.json is missing or unreadable; every language falls back to it`)
  return locales
}

/** The tags to try for `tag`, most specific first, ending with the base: `fr-CA` → fr-ca, fr, en. */
export function chain(tag) {
  const parts = String(tag ?? '').toLowerCase().split('-').filter(Boolean)
  const tags = parts.map((_, i) => parts.slice(0, parts.length - i).join('-'))
  return tags.includes(BASE) ? tags : [...tags, BASE]
}

const primary = tag => tag.split('-')[0]

/**
 * A complete table for every tag there is a file for: the base, overlaid by the primary language,
 * overlaid by the tag's own file. A regional file without its primary one also answers for the
 * primary tag, so `zh-CN.json` alone serves a page set to `zh`.
 *
 * @param {Record<string, Record<string, string>>} locales - from `readLocales`
 */
export function tables(locales) {
  const base = locales[BASE] ?? {}
  const out = {}
  for (const tag of Object.keys(locales)) {
    out[tag] = { ...base, ...(locales[primary(tag)] ?? {}), ...locales[tag] }
  }
  for (const tag of Object.keys(locales)) {
    if (out[primary(tag)] === undefined) out[primary(tag)] = out[tag]
  }
  return out
}

/**
 * The complete table for one requested tag and the tag it was found under (lower case): the most
 * specific tag in `chain(tag)` that `tables` has, else the base.
 *
 * @param {Record<string, Record<string, string>>} locales - from `readLocales`
 * @param {string} tag
 * @returns {{ tag: string, messages: Record<string, string> }}
 */
export function tableFor(locales, tag) {
  const byTag = new Map(Object.entries(tables(locales)).map(([key, table]) => [key.toLowerCase(), table]))
  for (const candidate of chain(tag)) {
    if (byTag.has(candidate)) return { tag: candidate, messages: byTag.get(candidate) }
  }
  return { tag: BASE, messages: {} }
}
