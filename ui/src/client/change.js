/**
 * Change cues: a short accent wash with a left bar on something that just
 * changed in front of the person, the "just now" label that goes with it, and
 * the dot for what changed since they last looked. With reduced motion the
 * wash is not drawn; the dot carries the news alone.
 */
import { createElement as h, useEffect, useRef, useState } from 'react'

export const WASH_MS = 2000

/**
 * A class name, `uk-wash`, for about two seconds after `version` changes, and '' otherwise. Nothing on the first
 * render, and nothing when `key` changed too (the element now shows something else, which didn't "change").
 * @param {unknown} version - anything comparable with `===`, such as an etag or a content hash
 * @param {unknown} [key] - what the element shows (an item id)
 */
export function useWash(version, key) {
  const seen = useRef({ version, key })
  const [washing, setWashing] = useState(0)
  useEffect(() => {
    const before = seen.current
    seen.current = { version, key }
    if (before.version === version || before.key !== key) return undefined
    setWashing(count => count + 1)
    const timer = setTimeout(() => setWashing(0), WASH_MS)
    return () => clearTimeout(timer)
  }, [version, key])
  // A new count restarts the animation: React gives the element a different class for one render cycle.
  return washing === 0 ? '' : washing % 2 === 1 ? 'uk-wash' : 'uk-wash uk-washAgain'
}

/**
 * The wrapper form of useWash.
 * @param {object} props
 * @param {unknown} props.version
 * @param {unknown} [props.washKey]
 * @param {string} [props.as] - the element (default div)
 */
export function Wash({ version, washKey, as = 'div', className, children, ...rest }) {
  const wash = useWash(version, washKey)
  return h(as, { ...rest, className: [className, wash].filter(Boolean).join(' ') || undefined }, children)
}

export function createChange({ useWords }) {
  /** The small "just now" beside something that is washing. */
  function JustNow() {
    const { t } = useWords()
    return h('span', { className: 'uk-justNow' }, t('justNow'))
  }

  /** The dot for "new since you last looked". */
  function NewDot() {
    const { t } = useWords()
    return h('span', { className: 'uk-newDot', role: 'img', 'aria-label': t('newSince'), title: t('newSince') })
  }

  return { JustNow, NewDot }
}
