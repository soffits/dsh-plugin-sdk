/**
 * A small Server-Sent Events reader for streams that arrive as text chunks
 * (the page transport's fetch), with the same result as EventSource for the
 * parts a plugin uses: `data` lines joined, comments and other fields ignored.
 */
export function createSseParser(onData) {
  let buffer = ''
  let data = []
  const line = text => {
    if (text === '') {
      if (data.length > 0) onData(data.join('\n'))
      data = []
      return
    }
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    if (field !== 'data') return
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    data.push(value)
  }
  return {
    feed(chunk) {
      buffer += chunk
      let at
      while ((at = buffer.search(/\r\n|\r|\n/)) !== -1) {
        const end = buffer[at] === '\r' && buffer[at + 1] === '\n' ? at + 2 : at + 1
        line(buffer.slice(0, at))
        buffer = buffer.slice(end)
      }
    },
  }
}

/** Seconds to wait before reconnect attempt `attempt` (0-based): 1, 2, 4 … up to 30, with a little jitter. */
export function backoff(attempt, random = Math.random) {
  return Math.min(30, 2 ** attempt) * (0.8 + random() * 0.4)
}
