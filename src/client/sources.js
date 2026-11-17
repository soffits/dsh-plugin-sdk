/**
 * The plugins that offer items: their name and icon, registered once when
 * their client starts, so an item card shows them even when the plugin's page
 * was never opened. `name` may be a function, read at render time, so it
 * follows the person's language.
 */
import { useSyncExternalStore } from 'react'

export function createSources() {
  const entries = new Map()
  const listeners = new Set()
  let version = 0
  const changed = () => { version += 1; for (const listener of listeners) listener() }
  const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
  const resolve = entry => (entry === undefined ? undefined : { name: typeof entry.name === 'function' ? entry.name() : entry.name, icon: entry.icon })

  return {
    /**
     * @param {{ id: string, name: string | (() => string), icon?: Function }} source - `id` is the package name; `icon` a component taking `{ size }`
     * @returns {() => void} unregisters
     */
    register(source) {
      if (typeof source?.id !== 'string' || source.id === '') throw new TypeError('registerSource needs an id (the package name)')
      const entry = { name: source.name, icon: source.icon }
      entries.set(source.id, entry)
      changed()
      return () => {
        if (entries.get(source.id) === entry) {
          entries.delete(source.id)
          changed()
        }
      }
    },
    name: id => resolve(entries.get(id))?.name,
    useSource(id) {
      useSyncExternalStore(subscribe, () => version)
      return resolve(entries.get(id))
    },
  }
}
