/**
 * Server-Sent Events answers for a plugin's `/api` Fetch routes. Each stream says `retry` once, sends
 * a comment every `heartbeatMs` so proxies keep it open, and ends when the page goes (the request's
 * abort or the reader's cancel), when the route ends it, or when the plugin unloads (`close()`): DSH
 * drops a plugin's routes on unload but not the streams it already answered, which would otherwise
 * live on, beating, with nobody left to tell them anything.
 *
 * @param {{ heartbeatMs?: number, headers?: Record<string, string> }} [options] - `headers` are added
 *   to every answer (a plugin's own security headers, say)
 */
export function createEventStreams({ heartbeatMs = 25_000, headers = {} } = {}) {
  const open = new Set()

  /**
   * Answer `request` with a stream. `start` runs once the stream is open, gets `send(value)` (one
   * `data:` event with `value` as JSON) and `end()`, and returns (or resolves to) the function that
   * stops whatever feeds the stream; it runs exactly once, however the stream ends.
   *
   * @param {{ signal?: AbortSignal }} request
   * @param {(stream: { send: (value: unknown) => void, end: () => void }) => (void | (() => void) | Promise<void | (() => void)>)} start
   * @returns {Response}
   */
  function respond(request, start) {
    const encoder = new TextEncoder()
    let finish = () => {}
    const body = new ReadableStream({
      async start(controller) {
        let live = true
        let stop = () => {}
        const write = text => {
          if (!live) return
          try {
            controller.enqueue(encoder.encode(text))
          } catch {
            end()
          }
        }
        const beat = setInterval(() => write(': beat\n\n'), heartbeatMs)
        finish = () => {
          if (!live) return
          live = false
          clearInterval(beat)
          open.delete(end)
          request.signal?.removeEventListener?.('abort', end)
          stop()
        }
        const end = () => {
          finish()
          try {
            controller.close()
          } catch {
            // Already closed.
          }
        }
        open.add(end)
        request.signal?.addEventListener?.('abort', end, { once: true })
        if (request.signal?.aborted) return end()
        write('retry: 5000\n: open\n\n')
        let stopping
        try {
          stopping = await start({ send: value => write(`data: ${JSON.stringify(value)}\n\n`), end })
        } catch (error) {
          finish()
          controller.error(error)
          return
        }
        if (typeof stopping !== 'function') return
        if (live) stop = stopping
        else stopping()
      },
      cancel() {
        finish()
      },
    })
    return new Response(body, {
      status: 200,
      headers: { ...headers, 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'private, no-cache, no-transform', 'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff' },
    })
  }

  return {
    respond,
    /** End every open stream (the plugin is going away). */
    close() {
      for (const end of [...open]) end()
    },
  }
}
