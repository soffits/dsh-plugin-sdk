/**
 * Change notices for open pages: something a page shows has changed, and what kind. A notice carries
 * no data; the page reads again. Where the changes come from (a file watch, a stat, the plugin's own
 * writes) is the plugin's business; this is the part every plugin needs between that and its pages.
 *
 * Notices that come close together go out as one batch: a batch leaves `settleMs` after its first
 * notice (a write and the rename that follows it are one change), and never sooner than `spacingMs`
 * after the batch before (a download's progress doesn't flood a page).
 *
 * A notice may name its `scope` (whose data changed, say a person id); a listener hears only the
 * scopes it accepts. A notice without a scope reaches everyone.
 *
 * @param {{ settleMs?: number, spacingMs?: number }} [options]
 */
export function createNotices({ settleMs = 0, spacingMs = 0 } = {}) {
  const listeners = new Set()
  let pending = []
  let timer
  let lastAt = -Infinity

  function flush() {
    timer = undefined
    lastAt = Date.now()
    const batch = pending
    pending = []
    for (const listener of [...listeners]) {
      const what = new Set()
      for (const notice of batch) {
        if (notice.scope === undefined || listener.accepts === undefined || listener.accepts(notice.scope)) what.add(notice.what)
      }
      if (what.size > 0) listener.send([...what])
    }
  }

  return {
    /**
     * Something of kind `what` changed, for `scope` (omit for everyone).
     * @param {string} what
     * @param {string} [scope]
     */
    notify(what, scope) {
      pending.push({ what, scope })
      if (timer !== undefined) return
      timer = setTimeout(flush, Math.max(settleMs, lastAt + spacingMs - Date.now()))
    },
    /**
     * Hear batches of kinds (`send(['library', 'rooms'])`), only for the scopes `accepts` takes
     * (omit it to hear every scope).
     * @param {(what: string[]) => void} send
     * @param {(scope: string) => boolean} [accepts]
     * @returns {() => void} stop listening
     */
    listen(send, accepts) {
      const listener = { send, accepts }
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Drop every listener and anything pending (the plugin is going away). */
    close() {
      clearTimeout(timer)
      timer = undefined
      pending = []
      listeners.clear()
    },
  }
}
