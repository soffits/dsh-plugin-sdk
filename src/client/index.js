/**
 * The Web client: provides `ctx.uiActions` and draws items in messages.
 *
 *   ctx.uiActions.ActionBar      buttons for one item (React component)
 *   ctx.uiActions.ActionButton   one button
 *   ctx.uiActions.chat(about, { prompt, session })
 *   ctx.uiActions.registerSource({ id, name, icon }) → dispose
 */
import { useCallback, useSyncExternalStore } from 'react'
import locales from 'virtual:locales'
import { itemRule, ITEM_NODE } from '../rule.js'
import { createBar } from './bar.js'
import { createCard } from './card.js'
import { createChat } from './chat.js'
import { CSS, STYLE_ID } from './look.js'
import { createSources } from './sources.js'

export const NS = 'dsh-ui-actions'
export const name = 'ui-actions'
export const inject = ['slots', 'locale']

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = []
    for (const [tag, file] of Object.entries(locales)) {
      try {
        disposers.push(ctx.locale.register(NS, tag, file.ui))
      } catch (error) {
        // a language this DSH doesn't know yet; its file waits for a DSH that does
        console.warn(`dsh-ui-actions: no ${tag} words`, error)
      }
    }
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-actions: words')

  if (typeof document !== 'undefined') {
    ctx.effect(() => {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.dataset.plugin = '@soffits/dsh-ui-actions'
      style.textContent = CSS
      document.head.appendChild(style)
      return () => style.remove()
    }, 'ui-actions: styles')
  }

  const t = ctx.locale.bind(NS)
  const useWords = () => {
    const subscribe = useCallback(listener => ctx.locale.subscribe(listener), [])
    useSyncExternalStore(subscribe, () => ctx.locale.getSnapshot().active)
    return t
  }
  const sources = createSources()
  const { chat, Adopter } = createChat({ ctx, t, sources })
  const { ActionBar, ActionButton } = createBar({ useWords, chat })
  const ItemCard = createCard({ sources })

  ctx.provide('uiActions', { ActionBar, ActionButton, chat, registerSource: source => sources.register(source) })

  ctx.inject(['uiConversation'], scope => {
    scope.effect(() => scope.uiConversation.userText.register(itemRule), 'ui-actions: item rule')
  })
  ctx.slots.inject('conversation.user.text.node', () => ctx.slots.register({ name: 'conversation.user.text.node', key: ITEM_NODE, priority: 100, locale: NS }, ItemCard))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'ui-actions.adopt', order: 100 }, Adopter))
}
