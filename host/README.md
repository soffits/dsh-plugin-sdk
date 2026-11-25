# Host helpers

Part of [@soffits/dsh-plugin-sdk](../README.md): `@soffits/dsh-plugin-sdk/host` (and `/host/build`). Its history before the merge is in the archived [soffits/dsh-host-kit](https://github.com/soffits/dsh-host-kit) repository.

Small helpers for the host half of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugins, the parts every plugin with its own page ends up writing:

- **Who is asking** (`createPeople`, `viewerOf`, `personKey`, `expandHome`): maps the verified user behind an `/api` request (from any plugin that provides the `requestIdentity` service) to a person id, from inline config and an optional JSON file that is re-read when it changes. Without a mapping, everyone DSH lets in is its owner. A broken mapping file maps nobody, so it never widens access.
- **Words** (`readLocales`, `tables`, `tableFor`, `chain`, `BASE`, `TAG`): one `locale/<tag>.json` per language, `{ meta, ui }`. A missing word comes from the primary language, then from English, and a new language is a new file.
- **Change notices** (`createNotices`): tells open pages that something they show changed, merged into batches (`settleMs` after the first notice, at least `spacingMs` apart) and filtered per listener by scope, such as a person id.
- **Event streams** (`createEventStreams`): Server-Sent Events answers for Fetch routes, with a heartbeat, and ended when the page goes, when the route ends them, or when the plugin unloads (`close()`), so no stream outlives its plugin.
- **The client build** (`@soffits/dsh-plugin-sdk/host/build`: `buildClient`, `localeFiles`): bundles `src/client/` into `client.js` in DSH's module-loader format, registered under the package name, with `--check` failing on a stale build. Needs `esbuild` as a dev dependency of the plugin.

It is a plain library, not a DSH plugin: plugins list it as a dependency.

```js
import { createEventStreams, createNotices, createPeople, viewerOf } from '@soffits/dsh-plugin-sdk/host'

export function apply(ctx, config) {
  const people = createPeople(config, { warn: message => ctx.logger.warn(message) })
  const notices = createNotices({ settleMs: 50 })
  const streams = createEventStreams()
  ctx.effect(() => () => { streams.close(); notices.close() })
  ctx.connection.fetch.register({
    path: '/api/example/events',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async request => {
      const viewer = await viewerOf(people, ctx.get('requestIdentity'))
      if (viewer.unavailable) return Response.json({ error: 'No sign-in provider.' }, { status: 503 })
      const mine = viewer.mode === 'owner' ? undefined : scope => scope === viewer.person
      return streams.respond(request, ({ send }) => notices.listen(what => send({ type: 'change', what }), mine))
    },
  })
}
```

```js
// scripts/build.mjs
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildClient } from '@soffits/dsh-plugin-sdk/host/build'

await buildClient({ root: resolve(dirname(fileURLToPath(import.meta.url)), '..') })
```
