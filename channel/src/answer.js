/**
 * The text a finished turn leaves in its chat.
 *
 * Text written between tool calls ("Now the board entries.") streams into the
 * live reply like everything else, but it is working narration, not part of
 * the answer. So the final reply keeps, from each assistant message of the
 * turn, only an answer: the last text block of a message that called no tool.
 * A message that called a tool is mid-chain, so its text goes. The last block,
 * not all of them: Claude Code through dsh-oh-my-claude puts every text block
 * of its own tool loop into one message, with its tools recorded beside it.
 * Answers of several tool-free messages in one turn are kept, in order, up to
 * a message someone sent into the running turn (an interjection): the chat
 * shows that message where it was sent, so the answers before it stay above
 * it and the answers after it go below (`answerSegments`).
 *
 * An answer ending in the silent marker asks the bridge to post nothing more
 * (`cutSilent`): a model cannot end a turn with no text at all, since DSH
 * treats that as an empty response.
 */

/** The marker a final answer ends with to post nothing more. */
export const SILENT_REPLY = '[SILENT]'

/**
 * The answer one assistant message holds, or '' when it holds none.
 * @param message - an assistant message (`{ content: [...] }`).
 * @returns the last text block when the message called no tool.
 */
export function messageAnswer(message) {
  const content = Array.isArray(message?.content) ? message.content : []
  if (content.some((block) => block?.type === 'tool-call')) return ''
  const texts = content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter((text) => text.length > 0)
  return texts.at(-1) ?? ''
}

/**
 * Whether a recorded user message is one a person or a scheduled task sent,
 * not context a plugin added.
 * @param message - a `user/message` event's data.
 */
export function isInterjection(message) {
  const kind = message?.source?.kind
  return kind === 'user' || kind === 'schedule'
}

/**
 * The answers of one turn, split at messages sent into it after it started
 * replying: one string per part, earliest first.
 * @param events - session events (`{ type, data }`).
 * @param turn - DSH turn number.
 * @returns at least one string; '' for a part with no answer.
 */
export function answerSegments(events, turn) {
  const segments = [[]]
  if (!Array.isArray(events) || turn === undefined) return ['']
  let replied = false
  for (const event of events) {
    if (event?.type === 'turn/end' && event.data?.turn === turn) break
    if (event?.type === 'assistant/message') {
      if (event.data?.turn !== turn) {
        if (replied) break
        continue
      }
      replied = true
      const answer = messageAnswer(event.data?.message ?? event.data)
      if (answer.length > 0) segments.at(-1).push(answer)
      continue
    }
    if (replied && event?.type === 'user/message' && isInterjection(event.data)) segments.push([])
  }
  return segments.map((answers) => answers.join('\n\n'))
}

/**
 * The answer a turn's last reply message shows: its answers after the last
 * message sent into it.
 * @param events - session events (`{ type, data }`).
 * @param turn - DSH turn number.
 * @returns the answers joined by blank lines, or '' when none.
 */
export function turnAnswer(events, turn) {
  return answerSegments(events, turn).at(-1)
}

/**
 * Remove the silent marker from the end of an answer. A turn can hold several
 * assistant messages, so the marker may follow real text instead of standing
 * alone.
 * @param text - answer text.
 * @param options - `{ streaming }`: the text is still growing, so a trailing
 *   part that may yet become the marker is held back too.
 * @returns `{ text, silent }`: the text to show, and whether it ended with the marker.
 */
export function cutSilent(text, { streaming = false } = {}) {
  const trimmed = String(text ?? '').trim()
  if (trimmed.endsWith(SILENT_REPLY)) return { text: trimmed.slice(0, -SILENT_REPLY.length).trim(), silent: true }
  if (streaming) {
    const start = trimmed.lastIndexOf('[')
    if (start !== -1 && SILENT_REPLY.startsWith(trimmed.slice(start))) return { text: trimmed.slice(0, start).trim(), silent: false }
  }
  return { text: trimmed, silent: false }
}
