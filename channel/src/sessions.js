/**
 * The DSH side of a chat: finding, creating and prompting sessions through
 * the Host services the Web UI uses (`sessionController`), with the raw agent
 * registry as the headless fallback, and reading what a session said.
 */
import { randomUUID } from 'node:crypto'

/** @returns the Web session controller, when this deployment mounts it. */
export function controllerOf(ctx) {
  const controller = ctx.get('sessionController')
  return typeof controller?.create === 'function' && typeof controller?.resolveAgent === 'function' ? controller : undefined
}

/**
 * The live agent of a session, resuming it when needed.
 * @param ctx - Host context.
 * @param sessionId - session id.
 * @param resumeOptions - extra options for the agent registry's `resume`
 *   (`agentOptions`, `setup`), used only without a session controller.
 * @returns the agent; throws when the session cannot be resumed.
 */
export async function resolveAgent(ctx, sessionId, resumeOptions = {}) {
  const agents = ctx.get('agents')
  const live = agents?.get(sessionId)
  if (live !== undefined) return live
  const controller = controllerOf(ctx)
  if (controller !== undefined) {
    const found = await controller.resolveAgent(sessionId)
    if (found?.error !== undefined) throw found.error
    const agent = found?.agent ?? agents?.get(sessionId)
    if (agent === undefined) throw new Error(`session ${sessionId} has no live agent`)
    return agent
  }
  if (agents === undefined) throw new Error('dsh-agent is not mounted in this profile')
  const resumed = await agents.resume({ resumeSessionId: sessionId, ...resumeOptions })
  if (resumed?.agent === undefined) throw new Error(`session ${sessionId} could not be resumed`)
  return resumed.agent
}

/**
 * Create a session the way the Web UI composes one (preset, default model,
 * model-switch notices), falling back to the agent registry.
 * @param ctx - Host context.
 * @param options - `{ cwd, preset, setup, agentOptions, warn }`; `setup` and
 *   `agentOptions` go to the registry's `create` on the fallback path only.
 * @returns the new session's agent.
 */
export async function createSession(ctx, { cwd, preset, setup, agentOptions, warn }) {
  const controller = controllerOf(ctx)
  if (controller !== undefined) {
    try {
      const created = await controller.create({ cwd, ...(preset ? { agentPreset: preset } : {}) })
      return await resolveAgent(ctx, created.sessionId)
    } catch (error) {
      warn(`sessionController create failed, using the agent registry: ${error?.message ?? error}`)
    }
  }
  const agents = ctx.get('agents')
  if (agents === undefined) throw new Error('dsh-agent is not mounted in this profile')
  const meta = { cwd, ...(preset && ctx.get('agentPresets') !== undefined ? { agentPreset: preset } : {}) }
  const created = await agents.create({
    sessionId: `session-${randomUUID()}`,
    meta,
    ...(agentOptions === undefined ? {} : { agentOptions }),
    ...(setup === undefined ? {} : { setup }),
  })
  return created.agent
}

/**
 * End a new session's blank state with an empty turn that never reaches a
 * model. DSH hands a blank session (one that never started a turn) to the
 * next New conversation in the Web UI, and only `turn/start` ends that state.
 * The marker message is rejected at `agent/pre-step`, the gate DSH uses for
 * archived sessions, so the turn ends as blocked and the marker is never
 * recorded. Call it before the session is bound to a chat, so no mirror shows
 * this turn.
 * @param agent - the new session's agent.
 * @param marker - `{ text, rpcPrefix }`: the marker's text and request id prefix.
 * @param waitMs - longest wait for the empty turn to end.
 * @returns false when this agent cannot run the empty turn.
 */
export async function claimSession(agent, { text, rpcPrefix }, waitMs = 10_000) {
  if (typeof agent?.followup !== 'function' || typeof agent?.ctx?.on !== 'function') return false
  const id = randomUUID()
  const dispose = agent.ctx.on('agent/pre-step', (payload, next) => {
    const messages = Array.isArray(payload?.messages) ? payload.messages : []
    if (messages.length > 0 && messages.every((message) => message?.id === id)) return Promise.resolve({ kind: 'reject' })
    return next()
  })
  agent.followup({ id, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user', rpcId: `${rpcPrefix}:${id}` } })
  // The gate stays until the turn is over, so the marker can never reach a model.
  const idle = typeof agent.whenIdle === 'function' ? agent.whenIdle() : Promise.resolve()
  void idle.catch(() => undefined).finally(() => { if (typeof dispose === 'function') dispose() })
  let timer
  await Promise.race([
    idle.catch(() => undefined),
    new Promise((resolveWait) => { timer = setTimeout(resolveWait, waitMs) }),
  ])
  clearTimeout(timer)
  return true
}

/**
 * Attach a session to the workspace of its directory, creating the workspace
 * when needed, so it shows up in the Web UI sidebar.
 * @param ctx - Host context.
 * @param sessionId - session id.
 * @param cwd - session directory.
 * @param warn - logger.
 */
export async function attachToWorkspace(ctx, sessionId, cwd, warn) {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined) return
  try {
    let workspace = registry.list().find((entry) => entry.path === cwd)
    if (workspace === undefined) workspace = await registry.create(cwd)
    await workspace.attachSession(sessionId)
  } catch (error) {
    warn(`workspace attach failed for ${sessionId}: ${error?.message ?? error}`)
  }
}

/**
 * Bring an archived session back before a chat message starts a turn in it:
 * DSH admits prompts into archived sessions but rejects every model step.
 * @param ctx - Host context.
 * @param sessionId - session id.
 * @returns `unarchived`, `unsupported` (archived, and this DSH cannot bring it
 *   back), or undefined when the session is not archived.
 */
export async function unarchive(ctx, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  if (registry?.archivedSessionIds?.includes(sessionId) !== true) return undefined
  if (typeof registry.unarchiveSession !== 'function') return 'unsupported'
  await registry.unarchiveSession(sessionId)
  return 'unarchived'
}

const requestMatcher = (requestId) => (message) => message?.source?.kind === 'user' && message.source.rpcId === requestId

/** @returns whether a message the agent has not taken yet carries this request id. */
export function inInbox(agent, requestId) {
  const matches = requestMatcher(requestId)
  const inbox = agent?.inbox
  return inbox?.nextTurn?.some?.(matches) === true || inbox?.nextStep?.some?.(matches) === true
}

/** @returns whether a pending or recorded message carries this request id. */
export function hasRequest(agent, requestId) {
  if (inInbox(agent, requestId)) return true
  const matches = requestMatcher(requestId)
  const events = typeof agent?.session?.snapshotEvents === 'function' ? agent.session.snapshotEvents() : []
  return events.some((event) => event?.type === 'user/message' && matches(event.data))
}

/**
 * Hand one prompt to a session. Text goes through the session controller's
 * `prompt`, the Web UI's own path; prompts with stored attachments go to the
 * agent's `steer` (into the running turn) or `followup` (queued), the methods
 * that path calls. A request id already admitted is skipped, so a message
 * handled twice (a redelivery, a restart between admission and marking it
 * seen) reaches the agent once. In steer mode DSH keeps a running turn going
 * while its next-step inbox holds input and opens a new turn for input left
 * after `turn/end`, so a steered prompt is never dropped.
 * @param ctx - Host context.
 * @param agent - the session's agent.
 * @param prompt - `{ requestId, text, attachments, mode, principal, envelope,
 *   clientTimeZone }`; `mode` is `queue` or `steer`; `principal` and
 *   `envelope` go on the message's source (the controller builds its own
 *   message, so the tagger records them at its step); `clientTimeZone` is
 *   DSH's field for the zone of the person behind a prompt.
 * @param signal - request lifetime.
 * @param tagger - a `createPrincipalTagger` that records the metadata on the
 *   controller's message.
 * @returns `admitted`, `known` (already admitted), `empty`, or `unsupported`
 *   when the agent offers no way in.
 */
export async function admitPrompt(ctx, agent, { requestId, text, attachments = [], mode, principal, envelope, clientTimeZone }, signal, tagger) {
  if (hasRequest(agent, requestId)) return 'known'
  const content = [...(text.trim().length === 0 ? [] : [{ type: 'text', text }]), ...attachments]
  if (content.length === 0) return 'empty'
  const zone = clientTimeZone === undefined ? {} : { clientTimeZone }
  const controller = ctx.get('sessionController')
  if (attachments.length === 0 && typeof controller?.prompt === 'function') {
    tagger?.remember(requestId, { principal, envelope })
    await controller.prompt({ sessionId: agent.session?.id ?? agent.id, requestId, mode, content, ...zone }, signal)
    return 'admitted'
  }
  const steer = mode === 'steer'
  const enter = steer ? agent?.steer : agent?.followup
  if (typeof enter !== 'function' && typeof agent?.send !== 'function') return 'unsupported'
  tagger?.remember(requestId, { principal, envelope })
  const message = {
    id: randomUUID(),
    role: 'user',
    content,
    source: { kind: 'user', rpcId: requestId, ...zone, ...(principal === undefined ? {} : { principal }), ...(envelope === undefined ? {} : { envelope }) },
  }
  if (typeof enter === 'function') enter.call(agent, message)
  else agent.send(message, steer ? 'next-step' : 'next-turn', true)
  return 'admitted'
}

/**
 * Remove prompts the agent has not taken yet, from both inboxes.
 * @param agent - the session's agent.
 * @param ours - test on a prompt's request id, so only the chat's own go.
 * @returns how many were removed.
 */
export function removePending(agent, ours) {
  const inbox = agent?.inbox
  if (typeof inbox?.remove !== 'function') return 0
  const matches = (message) => message?.source?.kind === 'user' && typeof message.source.rpcId === 'string' && ours(message.source.rpcId)
  const pending = [...(inbox.nextStep ?? []), ...(inbox.nextTurn ?? [])].filter(matches)
  for (const message of pending) inbox.remove(message.id)
  return pending.length
}

/**
 * Whether the agent still holds input it has not taken; DSH starts another
 * turn for it right after the current one ends.
 */
export function hasPendingInput(agent) {
  const inbox = agent?.inbox
  if (inbox === undefined) return false
  if (typeof inbox.hasPending === 'boolean') return inbox.hasPending
  return (inbox.nextStep?.length ?? 0) > 0 || (inbox.nextTurn?.length ?? 0) > 0
}

const SURFACE_TYPES = new Set(['system/message', 'user/message', 'developer/message', 'assistant/message', 'tool/result'])

/**
 * Whether a session's first surface node is its system message. DSH's log
 * format rejects a log whose first system message comes after another surface
 * message, so only then may a message be appended outside a step.
 * @param session - DSH session.
 * @returns false when the head cannot be read, so callers queue instead.
 */
export function hasSystemHead(session) {
  try {
    const nodes = session.surface?.nodes
    if (nodes !== undefined) {
      if (nodes.length === 0) return false
      const event = typeof session.eventAt === 'function'
        ? session.eventAt(nodes[0])
        : session.snapshotEvents?.().find((item) => item.seq === nodes[0])
      return event?.type === 'system/message'
    }
    const events = typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : session.events
    if (!Array.isArray(events)) return false
    return events.find((event) => SURFACE_TYPES.has(event.type))?.type === 'system/message'
  } catch {
    return false
  }
}

/**
 * Put a message into a session without starting a turn: appended now to an
 * idle session whose surface starts with its system message, otherwise queued
 * for its next step. Either way the Web UI shows it and the model reads it at
 * its next step.
 * @param agent - the session's agent.
 * @param message - a user-role message (`{ id, role, content, source }`).
 */
export function recordMessage(agent, message) {
  if (agent.status === 'idle' && typeof agent.session?.append === 'function' && hasSystemHead(agent.session)) {
    agent.session.append('user/message', message, { surfaceOp: 'append' })
  } else if (typeof agent.inject === 'function') {
    agent.inject(message)
  } else if (typeof agent.send === 'function') {
    agent.send(message, 'next-step', false)
  } else {
    throw new Error('The session cannot record messages.')
  }
}

/**
 * A session's title as DSH stores it.
 * @param ctx - Host context.
 * @param sessionId - session id.
 * @returns the title, or undefined while the session has none.
 */
export async function storedTitle(ctx, sessionId) {
  try {
    const snapshot = await ctx.get('sessionQuery')?.readTitleSnapshot(sessionId)
    const title = snapshot?.title?.title
    return typeof title === 'string' && title.trim().length > 0 ? title.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * The latest assistant texts of a session, newest first.
 * @param ctx - Host context.
 * @param sessionId - session id.
 * @param limit - most texts.
 * @returns the texts; empty when the session cannot be read.
 */
export async function recentAssistantTexts(ctx, sessionId, limit) {
  const texts = []
  try {
    const surface = await ctx.get('sessionQuery')?.readSurface(sessionId)
    const events = surface?.events ?? []
    for (let index = events.length - 1; index >= 0 && texts.length < limit; index -= 1) {
      const event = events[index]
      if (event?.type !== 'assistant/message') continue
      const message = event.data?.message ?? event.data
      const content = Array.isArray(message?.content) ? message.content : []
      const text = content.filter((block) => block?.type === 'text').map((block) => block.text).join('\n').trim()
      if (text.length > 0) texts.push(text)
    }
  } catch {
    // An empty result is reported by the caller.
  }
  return texts
}

/** @returns the registered workspaces, or an empty list. */
export function listWorkspaces(ctx) {
  try {
    return ctx.get('workspaceRegistry')?.list() ?? []
  } catch {
    return []
  }
}

/**
 * Recent ordinary sessions (not archived, not subagents), newest first.
 * @param ctx - Host context.
 * @param workspace - workspace record, or undefined for every workspace.
 * @param limit - most sessions.
 * @param signal - request lifetime.
 */
export async function sessionsInWorkspace(ctx, workspace, limit, signal) {
  const query = ctx.get('sessionQuery')
  if (query === undefined) return []
  const archived = new Set(ctx.get('workspaceRegistry')?.archivedSessionIds ?? [])
  const records = await query.listSessions(signal)
  return records
    .filter((record) => !archived.has(record.header.id))
    .filter((record) => record.header?.origin !== 'subagent')
    .filter((record) => workspace === undefined
      || (workspace.sessionIds ?? []).includes(record.header.id)
      || record.header.cwd === workspace.path)
    .sort((left, right) => (right.header.createdAt ?? 0) - (left.header.createdAt ?? 0))
    .slice(0, limit)
}

/** Sandbox mode and approval policy behind each built-in access mode. */
const ACCESS_MODES = {
  'workspace-write': ['workspace-write', 'ask'],
  'danger-full-access': ['danger-full-access', 'never'],
  'read-only': ['read-only', 'ask'],
}

/**
 * Set a session's access mode by appending its knob events, for a DSH whose
 * `permissionPresets` service cannot set it from a plugin.
 * @param session - DSH session.
 * @param value - a built-in access mode.
 * @returns false for a mode this fallback does not know.
 */
export function appendAccessMode(session, value) {
  const spec = ACCESS_MODES[value]
  if (spec === undefined) return false
  session.append('permission/preset', { preset: value })
  session.append('sandbox/mode', { mode: spec[0] })
  session.append('approval/policy', { policy: spec[1] })
  return true
}
