# Decisions

## Shape

- A plain library package, not a DSH plugin (no `dsh` bundle field): DSH shares its own code the same way (`@deepseek-ai/dsh-util-*` are ordinary dependencies), and a profile installs a plugin's dependencies with it. Multi-channel community plugins (dsh-lane-bridge, RICO-DEV-GIT/dsh-channel-core) put every network in one plugin with a base adapter instead; that does not fit here, since dsh-telegram-bot is a fork that keeps merging its upstream and each bridge is installed on its own.
- Only what both bridges use with the same rule lives here. A network's own parts (Telegram's callback keys and picker pages, its spoken-media fields, each network's user principal, Matrix HTML) stay in the bridge, which builds on these pieces.
- No runtime dependencies and no DSH imports: every DSH service comes in through the Host context (`ctx.get(...)`) the bridge passes, so the package runs and tests without a harness.

## Rules

- The silent marker is cut wherever it ends the answer, also after real text, since a turn can hold several assistant messages. While streaming, a trailing `[` that may grow into the marker is held back so it never flashes.
- One way to add sender metadata (`withMetadata`): fields the message already records win, so a principal DSH wrote itself is never replaced.
- `admitPrompt` reports `admitted`, `known`, `empty` or `unsupported` instead of a yes/no, because the bridges act differently on a duplicate (Telegram counts it as steered, Matrix releases its reaction).
- The bridge says what is its own in a call: the claim marker's text and request id prefix, which request ids are the chat's (`removePending`), the spool directory, the fallback title. The core never knows network names.
- `admitPrompt` checks the request id before every path, the controller's too, so a redelivered message never reaches a session twice whatever the path.
- `transcriptNote` takes the network's name from the caller instead of knowing networks.
