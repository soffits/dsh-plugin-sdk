/**
 * Who is asking. The caller comes from a `requestIdentity` service, if one is installed: any plugin
 * that verifies the person behind an `/api` request can provide it (`current()` returns
 * `{ id, name?, ... }` or null). The verified user id maps to a person id through the configured
 * mapping: inline `people` and an optional `peopleFile`.
 *
 * Two modes:
 * - people: a mapping is configured. A request needs a verified identity that maps to a person;
 *   without an identity provider nobody is anyone.
 * - owner: no mapping. Everyone DSH lets in is its owner, which is what a single-person DSH wants.
 */
import { readFile, stat } from 'node:fs/promises'

/** Person ids compare without regard to case, width or surrounding space. */
export function personKey(value) {
  return typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : ''
}

/** Expand a leading `~/` to the home folder. */
export function expandHome(path, home) {
  return typeof path === 'string' && (path === '~' || path.startsWith('~/')) ? home + path.slice(1) : path
}

/**
 * The configured user id → person id mapping, re-read from `peopleFile` whenever that file changes.
 * `peopleKey` names the object inside the file that holds the mapping, when it isn't the whole file.
 * A file that can't be read or parsed maps nobody (and is reported once per change), so a broken
 * file never widens access. Inline entries win over the file.
 *
 * @param {{ people?: Record<string, string>, peopleFile?: string, peopleKey?: string }} config
 * @param {{ warn?: (message: string) => void }} [options]
 */
export function createPeople({ people = {}, peopleFile = '', peopleKey = '' } = {}, { warn = () => {} } = {}) {
  const inline = Object.entries(people ?? {})
  const enabled = inline.length > 0 || peopleFile !== ''
  let cached = { tag: undefined, entries: [] }

  async function fromFile() {
    if (peopleFile === '') return []
    let tag
    try {
      const info = await stat(peopleFile)
      tag = `${info.ino}:${info.size}:${info.mtimeMs}`
    } catch (error) {
      tag = `error:${error.code}`
    }
    if (tag === cached.tag) return cached.entries
    let entries = []
    try {
      let value = JSON.parse(await readFile(peopleFile, 'utf8'))
      if (peopleKey !== '') value = value?.[peopleKey]
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(peopleKey ? `no object at key ${peopleKey}` : 'not a JSON object')
      entries = Object.entries(value).filter(([, person]) => typeof person === 'string')
    } catch (error) {
      warn(`people file ${peopleFile}: ${error.message}; nobody is mapped from it`)
    }
    cached = { tag, entries }
    return entries
  }

  return {
    enabled,
    /** The person id for a verified user id, or undefined. */
    async personFor(userId) {
      if (typeof userId !== 'string' || userId === '') return undefined
      const person = new Map([...(await fromFile()), ...inline]).get(userId)
      return person === undefined ? undefined : personKey(person)
    },
  }
}

/**
 * Who the current request is:
 * - `{ mode: 'owner' }` without a mapping;
 * - `{ mode: 'people', unavailable: true }` when a mapping is configured but no identity provider runs;
 * - `{ mode: 'people', person, name }` otherwise, where `person` is undefined for someone the mapping
 *   doesn't know (they may see nothing) and `name` is the display name the provider gave, or null.
 *
 * @param {ReturnType<typeof createPeople>} people
 * @param {{ current?: () => ({ id?: string, name?: string } | null) } | undefined} identityService
 */
export async function viewerOf(people, identityService) {
  if (!people.enabled) return { mode: 'owner' }
  if (typeof identityService?.current !== 'function') return { mode: 'people', unavailable: true }
  const identity = identityService.current()
  return { mode: 'people', person: await people.personFor(identity?.id), name: typeof identity?.name === 'string' ? identity.name : null }
}
