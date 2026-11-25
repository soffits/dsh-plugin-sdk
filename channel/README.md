# dsh-channel-core

Shared building blocks for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) chat bridges, the plugins that connect DSH sessions to a chat network. Each bridge keeps its own network code (receiving, sending, editing, ids); what should behave the same on every network lives here:

- **Final answer of a turn** (`messageAnswer`, `answerSegments`, `turnAnswer`, `isInterjection`): the last text block of each assistant message that called no tool, split where someone sent a message into the running turn. Narration between tool calls is not part of it.
- **Silent marker** (`SILENT_REPLY`, `cutSilent`): an answer ending in `[SILENT]` posts nothing more; while streaming, a trailing part that may still become the marker is held back.
- **Session models** (`sessionModelOf`, `selectSessionModel`, `createModelCatalog`, `modelName`, `effortChoices`, `effortName`, `pickedSelection`, `isGoneModel`, `sameSelection`, `defaultModelOf`, `findModel`): read and switch one session's model with the same catalog and rules as the Web model picker, without changing the default for new sessions.
- **Voice** (`transcribe`, `transcriptNote`, `pcmToWave`, `runProgram`): transcribe a recording with DSH speech-to-text (through ffmpeg) or a configured command, and the note the agent reads next to it.
- **Sessions** (`resolveAgent`, `createSession`, `claimSession`, `attachToWorkspace`, `unarchive`, `admitPrompt`, `hasRequest`, `removePending`, `hasPendingInput`, `recordMessage`, `recentAssistantTexts`, `storedTitle`, `listWorkspaces`, `sessionsInWorkspace`, `appendAccessMode`): find, create and prompt a chat's session through the Web UI's own session controller, with the agent registry as the fallback; a new session is never left blank for the Web UI's New conversation to take; prompts are admitted once per request id; notes go into a session without starting a turn.
- **Spool** (`enqueue`, `waitForResult`, `withdraw`, `createSpool`): a file queue in a directory the bridge picks, so a command line or a scheduled job can hand requests to the running bridge without a token or a network route to the Host.
- **Subagents** (`createAgentBoards`, `subagentsText`, `subagentLabel`, `boardText`, `agentsListText`, `collectSubagents`, `childState`, `reportOf`, `formatElapsed`): one status card per chat for the subagents a session starts, edited as they start and finish (kept at the bottom on networks whose message ids grow), and the `/agents` list read from DSH's durable catalogs.
- **Testing** (`@soffits/dsh-channel-core/testing`: `followupThroughGate`, `makeTitleService`, `makeAgentModel`): fakes of DSH behaviour for a bridge's own test Host.
- **Config** (`readLive`): read a plugin setting that may be a live reference.
- **Sender** (`sendPrincipal`, `withMetadata`, `createPrincipalTagger`, `senderSession`, `nonEmpty`): who sent a prompt as `source.principal`, and when and in reply to what as `source.envelope`, recorded on the message itself and never in its text. Network-specific principals (a Telegram user, a Matrix user) stay in each bridge and use the same fields.

It is a plain library, not a DSH plugin: bridges list it as a dependency. Used by [dsh-telegram-bot](https://github.com/soffits/dsh-telegram-bot) and [dsh-matrix-bot](https://github.com/soffits/dsh-matrix-bot).

```js
import { cutSilent, turnAnswer } from '@soffits/dsh-channel-core'

const { text, silent } = cutSilent(turnAnswer(events, turn))
```

## Development

`npm test`, `npm run check`. Node 22 or newer, no dependencies.

## License

MIT
