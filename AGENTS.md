# dsh-plugin-sdk

Shared parts for DeepSeek Harness (DSH) plugins in one package, each in its own folder with its source, tests and notes: `host/` (Host helpers, `./host` and `./host/build`), `channel/` (chat bridge helpers, `./channel` and `./channel/testing`), `ui/` (browser service `uiKit`) and `actions/` (browser service `uiActions`, `./actions/item`). `ui/` and `actions/` build their own browser module (`scripts/build.mjs` in each, esbuild, testable alone); `scripts/build-client.js` joins them into the package's `client.js`, whose plugin starts both. `index.js` is an empty Host row.

## Rules

- Checks: `npm run build` after any change under `ui/` or `actions/` (a test fails when a built file is stale), `npm run check`, `npm test`. Node 22 or later.
- Service names (`uiKit`, `uiActions`), locale namespaces and style ids stay as they are: plugins and pages depend on them.
- Every public export is a subpath in `package.json` `exports`; a consumer never imports a file path inside the package.
- A change to a shared part is a release of the SDK; consumers move to it with their next release (they depend on a caret range).
- License: MIT (Lucide icons ISC).

