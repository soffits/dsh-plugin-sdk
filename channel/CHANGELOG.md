# Changelog

## 0.2.0

- Session helpers both bridges used in their own copies: resolving and creating sessions, claiming a new one so the Web UI does not reuse it, workspaces, unarchiving, admitting a prompt once per request id (with sender, envelope and time zone), clearing a chat's pending prompts, recording a note without a turn, reading recent answers and titles, and the access-mode fallback.
- The file spool for requests from outside the Host, with the directory passed by the bridge. A spool stopped while it was starting no longer keeps polling, and a request's claim is removed before its result shows, so a stop in between can never send it twice.
- The subagent status card (`createAgentBoards`) and the `/agents` text (`subagentsText`), from the Telegram bridge.
- `@soffits/dsh-channel-core/testing`: fakes of DSH's pre-step gate, title service and model selection for bridge tests.
- `readLive` for settings that may be live references.

## 0.1.0

- First release: the final answer of a turn and the silent marker, session model selection from the Web catalog, voice transcription, and the sender principal and envelope recorded on prompts, taken from dsh-telegram-bot and dsh-matrix-bot so both use one copy.
