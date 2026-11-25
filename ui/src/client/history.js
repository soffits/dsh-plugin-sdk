/**
 * The earlier entries of one thing, stacked under it on a hairline: the
 * newest few, and the rest behind "+N earlier".
 */
import { createElement as h, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { formatFull, toTime } from '../time.js'

export function createHistory({ useWords, useNow }) {
  /**
   * @param {object} props
   * @param {Array<{ at: string, text: string }>} props.items - newest first
   * @param {number} [props.max] - shown before "+N earlier" (default 3)
   * @param {string} [props.moreLabel] - the caller's own words for the toggle, with {n}
   */
  function History({ items, max = 3, moreLabel }) {
    const { t, locale } = useWords()
    const now = useNow(60_000)
    const [open, setOpen] = useState(false)
    if (!items?.length) return null
    const shown = open ? items : items.slice(0, max)
    const hidden = items.length - shown.length
    const today = new Date(now).toDateString()
    const when = at => {
      const time = toTime(at)
      if (!Number.isFinite(time)) return ''
      const sameDay = new Date(time).toDateString() === today
      return new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time)
    }
    return h('div', { className: 'uk-history' },
      h('ol', null, shown.map((item, i) => h('li', { key: i },
        h('time', { dateTime: item.at, title: Number.isFinite(toTime(item.at)) ? formatFull(toTime(item.at), locale) : undefined }, when(item.at)),
        h('span', null, item.text)))),
      (hidden > 0 || open) && items.length > max && h(Button, { variant: 'ghost', size: 'sm', className: 'uk-historyToggle', onClick: () => setOpen(value => !value) },
        open ? t('less') : moreLabel ? moreLabel.replace('{n}', String(hidden)) : t('earlier', { n: hidden })))
  }
  return { History }
}
