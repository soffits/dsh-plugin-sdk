# dsh-ui-actions

Shared action buttons for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin pages, and a way to ask the agent about an item that keeps the item as a card instead of a lump of text.

- **Buttons** for anything a plugin shows (a card, a row, a notification): ask, done, snooze, a custom event, open a link. Same look, phone-sized touch targets, words in the person's language.
- **Ask about an item.** A new conversation opens with the item attached to the message box as a small removable card (its title and first line), and the person writes their own words beside it. The sent message shows the same card above their words, with the plugin's icon and name. The agent gets the item as a short quote it can read directly:

  ```
  > Hydro bill due Friday
  > [Item from Inbox (@soffits/dsh-notify-inbox)]
  > Hydro bill of $84.20 is due Friday.
  > context: {"notification":"20261117T170000Z-bill"}
  ```

  Because the item is ordinary text in the message, it survives copying, editing, queued messages and session search, and a DSH without this plugin still shows a readable quote.

It is a client-side library for other plugins; on its own it adds nothing to the page.

## Install

```sh
dsh plugin --profile web add @soffits/dsh-ui-actions
```

Needs DSH 0.2.2-rc.1 or later. From 0.2.2-rc.2 the card in the message box shows the item's title and first line; on rc.1 it shows the item's text cut to one line.

## For plugin authors

List the package in your `package.json` so your client loads after it, and use the service when it's there (your page still works without it):

```json
"dsh": { "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-locale", "@soffits/dsh-ui-actions"] } }
```

```js
apply(ctx) {
  ctx.inject(['uiActions'], scope => {
    scope.effect(() => {
      buttons = scope.uiActions                       // keep it for rendering
      return scope.uiActions.registerSource({ id: '@you/your-plugin', name: () => t('title'), icon: YourIcon })
    })
  })
}

// in a component
h(buttons.ActionBar, {
  actions: item.actions,                              // [{ kind, id, label?, payload? }]
  states: { done: 'pending' },                        // your server's view of each press, by action id
  about: { source: '@you/your-plugin', title: item.title, lines: ['Due Friday', '$84.20'], context: { id: item.id } },
  defaultChat: true,                                  // add "Chat about this" when the item declares no chat
  onPress: (action, extra) => post('/api/you/press', { id: item.id, action: action.id, ...extra }),
})
```

- `ActionBar({ actions, states, compact, about, defaultChat, onPress })` renders a row of buttons; `compact` shows icons only. `ActionButton({ action, state, compact, about, onPress })` is one button.
- Kinds: `chat` (opens a conversation about `about`; `payload.prompt` starts the person's message, `payload.context` replaces `about.context`, `payload.session` continues a session instead of opening a new one), `done`, `snooze` (a picker unless `payload.until`; `extra.until` goes to `onPress`), `event`, `link` (`payload.url`).
- `onPress` is your own server call for `done`, `snooze` and `event`; resolve when your server accepted the press. The button shows the press as pending until `states` says `done` or `unhandled`.
- A button without `label` uses this package's words; give `label` for your own wording (for example a name from your plugin's settings).
- `chat(about, { prompt, session })` does the same as a chat button, from your own code.
- `registerSource({ id, name, icon })` names your plugin on item cards; `name` can be a function so it follows the language, `icon` is a component taking `{ size }`. It returns a function that unregisters.
- `about.lines`: what the item shows, one entry per line (at most 15 are sent); `about.context`: small JSON with the ids and values the agent needs to act on it.

The item text format is exported as `@soffits/dsh-ui-actions/item` (`itemText`, `parseItem`, `itemRanges`) for tools that read messages.

## Languages

The buttons' words are in `locale/<tag>.json` (English, French and Chinese now). Add a language by adding a file with the same keys; DSH falls back to English for anything missing.

## Licence

MIT
