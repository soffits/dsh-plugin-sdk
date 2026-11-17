/**
 * Opening a conversation about an item: the item rides along as DSH's own
 * quote chip (a summary in the composer, the item text in the message), and
 * the person writes their own words beside it.
 */
import { useLayoutEffect } from 'react'
import { itemSummary, itemText, stepMessage } from '../item.js'
import { createPending, draftText } from '../pending.js'
import { recentWorkspace } from '../workspace.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * @param {object} options
 * @param {object} options.ctx - the client root context
 * @param {(key: string, params?: object) => string} options.t - this package's words
 * @param {{ name: (id: string) => string | undefined }} options.sources - registered plugins
 */
export function createChat({ ctx, t, sources }) {
  const pending = createPending()

  /** The input of a retained session, once DSH has it (opening a session takes a moment). */
  async function inputOf(session) {
    for (let i = 0; i < 50; i += 1) {
      const scope = ctx.get('sessions')?.scope(session)
      const conversation = scope?.get('conversation')
      if (scope !== undefined && conversation !== undefined) return conversation.input.for(scope)
      await sleep(100)
    }
    return undefined
  }

  /**
   * Open a conversation about an item.
   * @param {object} about - `{ source, sourceName?, title, lines?, context? }`; `source` is the offering plugin's package name
   * @param {object} [options]
   * @param {string} [options.prompt] - words to start the person's message with (editable)
   * @param {string} [options.session] - `new` (default) or a session id to continue
   */
  async function chat(about, { prompt = '', session = 'new' } = {}) {
    const workspace = ctx.get('uiWorkspace')
    if (workspace === undefined) throw new Error(t('noWorkspace'))
    const item = { ...about, sourceName: about.sourceName ?? sources.name(about.source) ?? about.source }
    const text = itemText(item)
    const summary = itemSummary(item)
    if (session === 'new') {
      const draft = draftText(text, prompt)
      pending.add({ draft, text, summary, prompt })
      workspace.startSession(undefined, { prompt: draft, whenDraftExists: 'replace' })
      return
    }
    workspace.openSession(session)
    const input = await inputOf(session)
    if (input === undefined) throw new Error(t('noSession'))
    if (!input.insertQuote(text, summary)) throw new Error(t('busy'))
    const binding = ctx.get('sessions')?.binding(session)
    if (prompt.trim() !== '' && binding !== undefined) ctx.get('conversation')?.input.requestDraftInitialization(binding, { prompt, whenDraftExists: 'append' })
  }

  /**
   * Start a suggested step: send the instruction and the item into a session
   * as the person, with no draft to confirm, and stay on the page.
   * @param {object} about - as for `chat`
   * @param {object} options
   * @param {string} options.instruction - what the person agreed to, in their language
   * @param {string} [options.session] - `new` (default) or a session id to continue
   * @returns {Promise<string>} the session id
   */
  async function start(about, { instruction, session = 'new' }) {
    const sessions = ctx.get('sessions')
    if (sessions === undefined) throw new Error(t('noWorkspace'))
    const item = { ...about, sourceName: about.sourceName ?? sources.name(about.source) ?? about.source }
    let id = session
    if (session === 'new') {
      const workspaceId = recentWorkspace(ctx.get('workspaces')?.list.getSnapshot() ?? {}, sessions.list.getSnapshot().byId)
      if (workspaceId === undefined) throw new Error(t('noWorkspace'))
      id = await sessions.create({ workspaceId })
    }
    await sessions.using(id, { source: 'uiActionsStep' }, async (reference) => {
      const { session: face } = await reference.ready
      const result = await face.prompt([{ type: 'text', text: stepMessage(instruction, item) }], 'queue')
      if (!result.ok) throw new Error(result.error?.message ?? t('noSession'))
    })
    return id
  }

  /** Show a session in the main view. */
  function open(session) {
    ctx.get('uiWorkspace')?.openSession(session)
  }

  /**
   * Zero-size member of every composer (`conversation.input.dock`): takes the
   * pending chat whose text is this composer's whole draft and swaps the text
   * for the item chip and the prompt.
   */
  function Adopter({ inputActions, useInput }) {
    const draft = useInput(state => state.draft)
    const editable = useInput(state => state.phase === 'plain')
    useLayoutEffect(() => {
      if (!editable || draft === '' || pending.size === 0) return
      const request = pending.take(draft)
      if (request === undefined) return
      inputActions.setDraft('')
      if (!inputActions.insertQuote(request.text, request.summary)) {
        inputActions.setDraft(request.draft)
        return
      }
      if (request.prompt.trim() !== '') inputActions.insertText(request.prompt, inputActions.captureInsertion())
    }, [draft, editable])
    return null
  }

  return { chat, start, open, Adopter }
}
