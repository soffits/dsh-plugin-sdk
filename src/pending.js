/**
 * Chats waiting for their new conversation's composer. DSH opens a new
 * conversation with text only and doesn't say which session it picked, so
 * the item first arrives as its readable quote text; the composer whose whole
 * draft is exactly that text takes the request and swaps the text for the
 * item chip. Only a fresh request with an exact match converts, so nothing a
 * person typed is ever touched. Pure: the clock is passed in.
 */

/** How long a request waits for its composer. */
export const PENDING_MS = 60_000

/** Drafts compared as the editor projects them: paragraph breaks and spacing may differ. */
export const sameDraft = (a, b) => a.replace(/\s+/gu, ' ').trim() === b.replace(/\s+/gu, ' ').trim()

/** The draft a new conversation starts with: the item as a Markdown quote, then the prompt. */
export function draftText(itemText, prompt = '') {
  const quote = itemText.split('\n').map(line => `> ${line}`).join('\n')
  return prompt.trim() === '' ? quote : `${quote}\n\n${prompt}`
}

export function createPending() {
  let requests = []
  return {
    /** @param {{ draft: string }} request */
    add(request, now = Date.now()) {
      requests = [...requests.filter(row => now - row.at < PENDING_MS), { ...request, at: now }]
    },
    /** The fresh request this draft is, removed so it converts once; or undefined. */
    take(draft, now = Date.now()) {
      requests = requests.filter(row => now - row.at < PENDING_MS)
      const index = requests.findIndex(row => sameDraft(row.draft, draft))
      if (index < 0) return undefined
      const [request] = requests.splice(index, 1)
      return request
    },
    get size() { return requests.length },
  }
}
