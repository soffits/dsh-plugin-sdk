# Decisions

- **A plain library, not a plugin or a service.** The helpers run inside each plugin with that plugin's config (its people mapping, its locale folder, its streams), so there is no shared state to own; a DSH service would add a load-order dependency for nothing. Same shape as DSH's own `dsh-util-*` packages and `@soffits/dsh-plugin-sdk/channel`.
- **Host side only, apart from the build.** Browser helpers live in the SDK's `ui` part, which the page gets from the module table. The build sits behind its own export so a plugin that loads the kit at run time never loads esbuild.
- **Notices carry kinds, not data.** Pages read again after a notice, so a batch can merge freely and a lost notice costs one refresh at most. Where changes come from (a file watch, a stat, the plugin's own writes) stays in each plugin, because each has a different source.
- **Streams end on unload.** DSH drops a plugin's routes on unload but not the streams already answered; `close()` ends them, so a page reconnects to the new instance instead of hanging on a stream nobody feeds.
- **Locale files are read on each request,** never kept from start: DSH swaps the browser half when the files change, before the host half reloads. Bad files are skipped with a warning instead of failing every language.
