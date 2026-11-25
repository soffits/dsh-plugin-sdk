import assert from 'node:assert/strict'
import test from 'node:test'
import { readLive } from '../src/config.js'
import { createPrincipalTagger } from '../src/principal.js'
import {
  admitPrompt,
  appendAccessMode,
  attachToWorkspace,
  claimSession,
  createSession,
  hasPendingInput,
  recentAssistantTexts,
  recordMessage,
  removePending,
  resolveAgent,
  sessionsInWorkspace,
  storedTitle,
  unarchive,
} from '../src/sessions.js'

const signal = new AbortController().signal
const hostOf = (services) => ({ get: (name) => services[name] })

function fakeAgent(events = []) {
  const agent = {
    id: 'session-a',
    session: { id: 'session-a', snapshotEvents: () => events },
    steered: [],
    queued: [],
    steer(message) { this.steered.push(message); this.inbox.nextStep.push(message) },
    followup(message) { this.queued.push(message); this.inbox.nextTurn.push(message) },
    inbox: {
      nextStep: [],
      nextTurn: [],
      remove(id) {
        for (const list of [this.nextStep, this.nextTurn]) {
          const index = list.findIndex((message) => message.id === id)
          if (index !== -1) list.splice(index, 1)
        }
      },
    },
  }
  return agent
}

test('readLive reads plain values and live references, with a fallback', () => {
  assert.equal(readLive('a', 'b'), 'a')
  assert.equal(readLive(null, 'b'), 'b')
  assert.equal(readLive({ get: () => 3 }, 1), 3)
  assert.equal(readLive({ get: () => undefined }, 1), 1)
  assert.equal(readLive({ get: () => { throw new Error('gone') } }, 1), 1)
})

test('a session is found live, through the controller, or resumed from the registry', async () => {
  const live = { id: 'live' }
  const resumed = []
  const agents = {
    get: (id) => (id === 'live' ? live : undefined),
    resume: async (options) => { resumed.push(options); return { agent: { id: options.resumeSessionId } } },
  }
  assert.equal(await resolveAgent(hostOf({ agents }), 'live'), live)
  const controller = { create() {}, resolveAgent: async (id) => (id === 'bad' ? { error: new Error('nope') } : { agent: { id } }) }
  assert.deepEqual(await resolveAgent(hostOf({ agents, sessionController: controller }), 's2'), { id: 's2' })
  await assert.rejects(resolveAgent(hostOf({ agents, sessionController: controller }), 'bad'), /nope/u)
  const setup = () => {}
  assert.deepEqual(await resolveAgent(hostOf({ agents }), 's3', { setup }), { id: 's3' })
  assert.deepEqual(resumed, [{ resumeSessionId: 's3', setup }])
  await assert.rejects(resolveAgent(hostOf({}), 's4'), /not mounted/u)
})

test('a session is created through the controller, else by the registry with the caller setup', async () => {
  const made = { id: 'made' }
  const controller = { create: async (request) => { made.request = request; return { sessionId: 'made' } }, resolveAgent: async () => ({ agent: made }) }
  assert.equal(await createSession(hostOf({ sessionController: controller }), { cwd: '/w', preset: 'p', warn: assert.fail }), made)
  assert.deepEqual(made.request, { cwd: '/w', agentPreset: 'p' })
  const warnings = []
  const created = []
  const setup = () => {}
  const broken = { create: async () => { throw new Error('down') }, resolveAgent: async () => ({}) }
  const agents = { get: () => undefined, create: async (options) => { created.push(options); return { agent: { id: options.sessionId } } } }
  const agent = await createSession(hostOf({ sessionController: broken, agents }), { cwd: '/w', preset: 'p', setup, warn: (line) => warnings.push(line) })
  assert.match(agent.id, /^session-/u)
  assert.deepEqual(created[0].meta, { cwd: '/w' }, 'no preset in meta without a preset service')
  assert.equal(created[0].setup, setup)
  assert.match(warnings[0], /down/u)
})

test('a claimed session runs one empty turn whose marker never reaches a step', async () => {
  const gates = []
  let finish
  const agent = {
    ctx: { on: (name, gate) => { gates.push({ name, gate }); return () => gates.splice(0) } },
    followup(message) { this.marker = message },
    whenIdle: () => new Promise((resolve) => { finish = resolve }),
  }
  const claiming = claimSession(agent, { text: '[claimed]', rpcPrefix: 'chat-claim' })
  assert.equal(gates[0].name, 'agent/pre-step')
  assert.match(agent.marker.source.rpcId, /^chat-claim:/u)
  assert.deepEqual(await gates[0].gate({ messages: [agent.marker] }, assert.fail), { kind: 'reject' })
  assert.equal(await gates[0].gate({ messages: [{ id: 'other' }] }, async () => 'next'), 'next')
  finish()
  assert.equal(await claiming, true)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(gates.length, 0, 'the gate is removed once the turn ends')
  assert.equal(await claimSession({}, { text: 'x', rpcPrefix: 'y' }), false)
})

test('workspaces: a session joins the workspace of its directory, made when missing', async () => {
  const attached = []
  const workspace = (path) => ({ path, attachSession: async (id) => attached.push([path, id]) })
  const registry = { list: () => [workspace('/a')], create: async (path) => workspace(path) }
  await attachToWorkspace(hostOf({ workspaceRegistry: registry }), 's1', '/a', assert.fail)
  await attachToWorkspace(hostOf({ workspaceRegistry: registry }), 's2', '/b', assert.fail)
  assert.deepEqual(attached, [['/a', 's1'], ['/b', 's2']])
})

test('an archived session is brought back, or reported when this DSH cannot', async () => {
  const back = []
  const registry = { archivedSessionIds: ['old'], unarchiveSession: async (id) => back.push(id) }
  assert.equal(await unarchive(hostOf({ workspaceRegistry: registry }), 'new'), undefined)
  assert.equal(await unarchive(hostOf({ workspaceRegistry: registry }), 'old'), 'unarchived')
  assert.deepEqual(back, ['old'])
  assert.equal(await unarchive(hostOf({ workspaceRegistry: { archivedSessionIds: ['old'] } }), 'old'), 'unsupported')
})

test('text goes through the session controller, as the Web UI sends it', async () => {
  const prompts = []
  const ctx = hostOf({ sessionController: { prompt: async (request) => { prompts.push(request) } } })
  const agent = fakeAgent()
  assert.equal(await admitPrompt(ctx, agent, { requestId: 'chat:1:7', text: 'hi', mode: 'steer' }, signal), 'admitted')
  assert.deepEqual(prompts, [{ sessionId: 'session-a', requestId: 'chat:1:7', mode: 'steer', content: [{ type: 'text', text: 'hi' }] }])
  await admitPrompt(ctx, agent, { requestId: 'chat:1:8', text: 'later', mode: 'queue', clientTimeZone: 'Europe/Berlin' }, signal)
  assert.equal(prompts[1].clientTimeZone, 'Europe/Berlin')
  assert.equal(prompts[1].mode, 'queue')
  assert.equal(agent.steered.length + agent.queued.length, 0)
})

test('attachments go to steer or followup once per request id', async () => {
  const ctx = hostOf({})
  const image = { type: 'image', attachment: { attachmentId: 'a' } }
  const agent = fakeAgent()
  assert.equal(await admitPrompt(ctx, agent, { requestId: 'r1', text: 'look', attachments: [image], mode: 'steer' }, signal), 'admitted')
  assert.equal(await admitPrompt(ctx, agent, { requestId: 'r1', text: 'look', attachments: [image], mode: 'steer' }, signal), 'known')
  assert.deepEqual(agent.steered.map((message) => message.content), [[{ type: 'text', text: 'look' }, image]])
  await admitPrompt(ctx, agent, { requestId: 'r2', text: '', attachments: [image], mode: 'queue' }, signal)
  assert.equal(agent.queued[0].source.rpcId, 'r2')
  const recorded = fakeAgent([{ type: 'user/message', data: { source: { kind: 'user', rpcId: 'r3' } } }])
  assert.equal(await admitPrompt(ctx, recorded, { requestId: 'r3', text: 'x', attachments: [image], mode: 'steer' }, signal), 'known')
  assert.equal(await admitPrompt(ctx, agent, { requestId: 'r4', text: '  ', mode: 'queue' }, signal), 'empty')
  assert.equal(await admitPrompt(ctx, {}, { requestId: 'r5', text: 'x', attachments: [image], mode: 'steer' }, signal), 'unsupported')
  const sent = []
  const plain = { send: (message, when, wake) => sent.push([message.source.rpcId, when, wake]) }
  await admitPrompt(ctx, plain, { requestId: 'r6', text: 'x', attachments: [image], mode: 'steer' }, signal)
  await admitPrompt(ctx, plain, { requestId: 'r7', text: 'x', attachments: [image], mode: 'queue' }, signal)
  assert.deepEqual(sent, [['r6', 'next-step', true], ['r7', 'next-turn', true]])
})

test('a prompt records its sender and envelope on both paths', async () => {
  const principal = { kind: 'chat-user', channel: 'chat', id: '42', name: 'Ana' }
  const envelope = { sentAt: 1_772_444_460_000 }
  const enter = (message) => ({ kind: 'enter', messages: [message] })
  const viaController = createPrincipalTagger()
  const ctx = hostOf({ sessionController: { prompt: async () => {} } })
  await admitPrompt(ctx, fakeAgent(), { requestId: 'r1', text: 'agreed', mode: 'steer', principal, envelope }, signal, viaController)
  const built = { id: 'm1', role: 'user', content: [{ type: 'text', text: 'agreed' }], source: { kind: 'user', rpcId: 'r1' } }
  const first = await viaController.preStep({}, async () => enter(built))
  assert.deepEqual(first.messages[0].source, { kind: 'user', rpcId: 'r1', principal, envelope })
  const agent = fakeAgent()
  await admitPrompt(hostOf({}), agent, { requestId: 'r2', text: 'and this', attachments: [{ type: 'file' }], mode: 'steer', principal, envelope, clientTimeZone: 'Europe/Berlin' }, signal, createPrincipalTagger())
  assert.deepEqual(agent.steered[0].source, { kind: 'user', rpcId: 'r2', clientTimeZone: 'Europe/Berlin', principal, envelope })
})

test('only the chat\'s own prompts not yet taken are removed', () => {
  const agent = fakeAgent()
  agent.inbox.nextStep.push({ id: 'a', source: { kind: 'user', rpcId: 'chat:100:1' } }, { id: 'b', source: { kind: 'user', rpcId: 'web-1' } })
  agent.inbox.nextTurn.push({ id: 'c', source: { kind: 'user', rpcId: 'chat:100:2' } }, { id: 'd', source: { kind: 'user', rpcId: 'chat:200:2' } })
  assert.equal(hasPendingInput(agent), true)
  assert.equal(removePending(agent, (id) => id.startsWith('chat:100:')), 2)
  assert.deepEqual([...agent.inbox.nextStep, ...agent.inbox.nextTurn].map((message) => message.id), ['b', 'd'])
  assert.equal(hasPendingInput({ inbox: { hasPending: false, nextStep: [{}] } }), false)
  assert.equal(hasPendingInput({}), false)
})

test('a recorded message is appended to an idle session that starts with its system message, else queued', () => {
  const message = { id: 'm', role: 'user', content: [], source: { kind: 'note' } }
  const appended = []
  const injected = []
  const session = (head) => ({
    surface: { nodes: [1] },
    eventAt: () => ({ type: head }),
    append: (...args) => appended.push(args),
  })
  recordMessage({ status: 'idle', session: session('system/message'), inject: (item) => injected.push(item) }, message)
  recordMessage({ status: 'idle', session: session('user/message'), inject: (item) => injected.push(item) }, message)
  recordMessage({ status: 'running', session: session('system/message'), inject: (item) => injected.push(item) }, message)
  assert.deepEqual(appended, [['user/message', message, { surfaceOp: 'append' }]])
  assert.equal(injected.length, 2)
  const eventsOnly = { snapshotEvents: () => [{ type: 'session/title' }, { type: 'system/message' }], append: (...args) => appended.push(args) }
  recordMessage({ status: 'idle', session: eventsOnly }, message)
  assert.equal(appended.length, 2)
  assert.throws(() => recordMessage({ status: 'running' }, message), /cannot record/u)
})

test('what a session said and its title are read from the session query', async () => {
  const say = (text) => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } })
  const tool = { type: 'assistant/message', data: { content: [{ type: 'tool_use' }] } }
  const sessionQuery = {
    readSurface: async () => ({ events: [say('first'), say('second'), tool, { type: 'user/message' }, say('third')] }),
    readTitleSnapshot: async (id) => (id === 'titled' ? { title: { title: ' Plan ' } } : undefined),
  }
  const ctx = hostOf({ sessionQuery })
  assert.deepEqual(await recentAssistantTexts(ctx, 's', 2), ['third', 'second'])
  assert.deepEqual(await recentAssistantTexts(hostOf({ sessionQuery: { readSurface: async () => { throw new Error('x') } } }), 's', 2), [])
  assert.equal(await storedTitle(ctx, 'titled'), 'Plan')
  assert.equal(await storedTitle(ctx, 'other'), undefined)
})

test('ordinary sessions of a workspace, newest first, without archived ones and subagents', async () => {
  const record = (id, cwd, createdAt, origin) => ({ header: { id, cwd, createdAt, ...(origin ? { origin } : {}) } })
  const sessionQuery = { listSessions: async () => [record('a', '/w', 1), record('b', '/w', 3), record('c', '/x', 2), record('d', '/w', 4, 'subagent'), record('e', '/w', 5)] }
  const ctx = hostOf({ sessionQuery, workspaceRegistry: { archivedSessionIds: ['e'] } })
  assert.deepEqual((await sessionsInWorkspace(ctx, { path: '/w', sessionIds: ['c'] }, 10, signal)).map((item) => item.header.id), ['b', 'c', 'a'])
  assert.deepEqual((await sessionsInWorkspace(ctx, undefined, 2, signal)).map((item) => item.header.id), ['b', 'c'])
})

test('access modes are set by their knob events when the preset service cannot', () => {
  const events = []
  const session = { append: (type, data) => events.push([type, data]) }
  assert.equal(appendAccessMode(session, 'danger-full-access'), true)
  assert.deepEqual(events, [['permission/preset', { preset: 'danger-full-access' }], ['sandbox/mode', { mode: 'danger-full-access' }], ['approval/policy', { policy: 'never' }]])
  assert.equal(appendAccessMode(session, 'custom'), false)
})
