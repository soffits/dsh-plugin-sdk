# dsh-plugin-sdk

Shared parts for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugins, in one package.

| Part | How a plugin gets it | What it is |
| --- | --- | --- |
| [Host helpers](host/README.md) | `import { … } from '@soffits/dsh-plugin-sdk/host'`, and `/host/build` for the client build | Who is asking (people and sign-in), locale files, change notices, event streams, and an esbuild-based build of a plugin's browser module. |
| [Chat bridge helpers](channel/README.md) | `import { … } from '@soffits/dsh-plugin-sdk/channel'`, and `/channel/testing` for test fakes | Sessions for chat channels, the spool a send command uses, answers and silent replies, subagent boards, voice, model controls. |
| [Page pieces](ui/README.md) | the browser service `ctx.uiKit` | Tiles, icons (Lucide), times and countdowns, live status, history, chat bubbles and a composer for plugin pages. |
| [Ask-the-assistant buttons](actions/README.md) | the browser service `ctx.uiActions`, and `/actions/item` for the item format | Buttons that start a conversation or a step about an item, and items drawn in messages. |

## Install

A plugin that uses the Host or chat helpers lists `@soffits/dsh-plugin-sdk` in its `dependencies`. A plugin whose page uses `ctx.uiKit` or `ctx.uiActions` needs the SDK installed in the profile, since its browser half provides them:

```bash
dsh plugin --profile <profile> add @soffits/dsh-plugin-sdk
```

and names it in its own `package.json`, so the page loads the SDK first:

```json
"dsh": { "client": { "platform": "web", "inject": ["@soffits/dsh-plugin-sdk"] } }
```

It brings one row, `plugin-sdk`, with nothing to set and no tools.

## History

The SDK was four packages until 0.1.0; their repositories are archived and their history is kept here: [dsh-host-kit](https://github.com/soffits/dsh-host-kit) (`host/`), [dsh-channel-core](https://github.com/soffits/dsh-channel-core) (`channel/`), [dsh-ui-kit](https://github.com/soffits/dsh-ui-kit) (`ui/`), [dsh-ui-actions](https://github.com/soffits/dsh-ui-actions) (`actions/`). The services keep their names (`uiKit`, `uiActions`), so a page that used them works unchanged once the SDK is installed.

## Development

```bash
npm ci
npm run build   # ui/client.js, actions/client.js, then client.js
npm run check
npm test
```

## License

MIT. The bundled icons are from [Lucide](https://lucide.dev) (ISC, `LICENSE-lucide`).
