/**
 * The slot for suggested next steps under a card or an item: a quiet
 * "Suggested" mark and the steps themselves, drawn by @soffits/dsh-ui-actions
 * (which records the press and starts the step). Nothing shows without steps,
 * or while that plugin isn't there.
 */
import { createElement as h, useSyncExternalStore } from 'react'
import { IconSparkleOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'

/** ctx.uiActions once it is there; null before, or without the plugin. */
export function createActionsStore() {
  let value = null
  const listeners = new Set()
  return {
    set(next) { value = next; for (const listener of listeners) listener() },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    get: () => value,
  }
}

export function createSuggested({ useWords, actionsStore }) {
  /**
   * @param {object} props
   * @param {object[]} props.actions - the item's actions as its data declares them; only `step` ones show here
   * @param {object} [props.about] - what the item is (dsh-ui-actions' `about`)
   * @param {Record<string, string>} [props.states] - press state by action id
   * @param {(action: object, extra: object) => Promise<unknown>} props.onPress - the offering plugin's press handler
   */
  function Suggested({ actions, about, states, onPress }) {
    const { t } = useWords()
    const uiActions = useSyncExternalStore(actionsStore.subscribe, actionsStore.get)
    const steps = (actions ?? []).filter(action => action?.kind === 'step')
    if (uiActions === null || steps.length === 0) return null
    return h('div', { className: 'uk-suggested' },
      h('span', { className: 'uk-suggestedLabel' }, h(IconSparkleOutlineRegular, { size: 13 }), t('suggested')),
      h(uiActions.ActionBar, { actions: steps, part: 'steps', about, states, onPress }))
  }
  return { Suggested }
}
