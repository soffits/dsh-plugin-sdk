# Changelog

## 0.1.0

- First release: the action bar for plugin pages (ask, done, snooze, event, link) as one client service, `ctx.uiActions`, instead of a copy in each plugin.
- "Ask" opens a conversation with the item attached as a removable card in the message box (DSH's own quote chip, showing the item's title and first line); the person writes beside it. The sent message shows the same card above their words, with the offering plugin's icon and name. The model gets the item as a short quote: its title, a marker naming the plugin, the lines shown, and its ids as one line of JSON.
- Words in `locale/<tag>.json` (English, French, Chinese); a new language is one file.
