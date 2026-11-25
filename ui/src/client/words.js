/**
 * The kit's own words (locale/<tag>.json, bundled at build) in the person's
 * active DSH language, and that language as an Intl locale.
 */
import { useCallback, useSyncExternalStore } from 'react'

export const NS = 'dsh-ui-kit'

/** The language id as an Intl locale, when this browser knows it. */
export function intlTag(active) {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf(active).length > 0 ? active : 'en'
  } catch {
    return 'en'
  }
}

export function createWords(ctx) {
  const t = ctx.locale.bind(NS)
  /** The active language, re-rendering on a switch. */
  function useLanguage() {
    const subscribe = useCallback(listener => ctx.locale.subscribe(listener), [])
    return useSyncExternalStore(subscribe, () => ctx.locale.getSnapshot().active)
  }
  /** `{ t, locale }` for a component: the kit's words and the Intl locale of the active language. */
  function useWords() {
    const active = useLanguage()
    return { t, locale: intlTag(active) }
  }
  return { t, useLanguage, useWords }
}
