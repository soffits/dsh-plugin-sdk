/**
 * Live updates from a plugin's Server-Sent Events route, and the line in a
 * page header that says whether the page is live.
 *
 * The stream goes through the page's own transport when the shell has one
 * (`__DSH_TRANSPORT__.fetch`, as DSH's own hot reload does), else through the
 * browser's EventSource. It reconnects with a growing pause; a page keeps its
 * own polling as the fallback while the status is not `live`.
 */
import { createElement as h, useEffect, useRef, useState } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { backoff, createSseParser } from '../sse.js'

/** A route path (`api/<plugin>/events?…`) as a URL against the page's base. */
const absolute = path => new URL(path, document.baseURI).href

async function readTransport(fetch, path, signal, onOpen, onData) {
  const response = await fetch(path, { method: 'GET', headers: { accept: 'text/event-stream' }, signal })
  if (!response.ok || response.body === null) throw new Error(`${path} answered ${response.status}`)
  onOpen()
  const parser = createSseParser(onData)
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    parser.feed(value)
  }
}

/**
 * Follow an SSE route while mounted.
 * @param {string | null} path - document-relative route, e.g. `api/card-board/events?board=home`; null pauses
 * @param {(message: unknown) => void} onMessage - each `data` payload, parsed as JSON (unparseable ones are skipped)
 * @returns {'connecting' | 'live' | 'down'}
 */
export function useEventStream(path, onMessage) {
  const [status, setStatus] = useState('connecting')
  const handler = useRef(onMessage)
  handler.current = onMessage
  useEffect(() => {
    if (!path || typeof document === 'undefined') return undefined
    let closed = false
    let attempt = 0
    let timer = null
    let close = () => {}
    const receive = data => {
      let message
      try { message = JSON.parse(data) } catch { return }
      handler.current(message)
    }
    const opened = () => { attempt = 0; setStatus('live') }
    const retry = () => {
      if (closed) return
      setStatus('down')
      timer = setTimeout(connect, backoff(attempt++) * 1000)
    }
    function connect() {
      if (closed) return
      setStatus(status => (status === 'live' ? 'live' : 'connecting'))
      const transport = globalThis.__DSH_TRANSPORT__
      if (transport?.fetch !== undefined) {
        const controller = new AbortController()
        close = () => controller.abort()
        readTransport(transport.fetch, path, controller.signal, opened, receive).then(retry, retry)
        return
      }
      const source = new EventSource(absolute(path), { withCredentials: true })
      close = () => source.close()
      source.onopen = opened
      source.onmessage = event => receive(event.data)
      // EventSource retries on its own after a dropped connection; a refused one (an HTTP error) stays closed.
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) retry()
        else setStatus('connecting')
      }
    }
    connect()
    return () => { closed = true; clearTimeout(timer); close() }
  }, [path])
  return status
}

export function createLive({ useWords }) {
  /**
   * "● Live · updated 13:34" while the stream is open; "Connecting" or just "Updated 13:34" otherwise.
   * @param {object} props
   * @param {'connecting' | 'live' | 'down'} props.status
   * @param {number | string} [props.updatedAt] - the newest data's time
   */
  function LiveStatus({ status, updatedAt }) {
    const { t, locale } = useWords()
    const time = typeof updatedAt === 'string' ? Date.parse(updatedAt) : updatedAt
    const known = Number.isFinite(time) && time > 0
    const sameDay = known && new Date(time).toDateString() === new Date().toDateString()
    const when = known ? new Intl.DateTimeFormat(locale, sameDay ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time) : ''
    const text = status === 'live'
      ? (known ? t('liveUpdated', { time: when }) : t('live'))
      : known ? t('updated', { time: when }) : status === 'connecting' ? t('connecting') : ''
    return h('span', { className: 'uk-live', 'data-status': status, role: 'status' },
      h(StateDot, { state: status === 'live' ? 'done' : 'idle' }),
      h('span', null, text))
  }
  return { LiveStatus }
}
