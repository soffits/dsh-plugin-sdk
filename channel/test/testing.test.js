import assert from 'node:assert/strict'
import test from 'node:test'
import { followupThroughGate, makeAgentModel, makeTitleService } from '../testing.js'

function fakeSession() {
  const events = []
  return { id: 's1', snapshotEvents: () => events, append: (type, data) => { events.push({ type, data, seq: events.length + 1 }) } }
}

test('a queued message passes the pre-step gate: rejected ones are never recorded, notices kept apart', async () => {
  const agent = { received: [] }
  const reject = (payload, next) => (payload.messages[0].id === 'marker' ? Promise.resolve({ kind: 'reject' }) : next())
  const notice = async (payload, next) => {
    const decision = await next()
    return { ...decision, messages: [...decision.messages, { id: 'n', source: { kind: 'notice' } }] }
  }
  followupThroughGate(agent, { id: 'marker', source: { kind: 'user' } }, [reject])
  followupThroughGate(agent, { id: 'hello', source: { kind: 'user' } }, [reject, notice])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(agent.turns, 2)
  assert.deepEqual(agent.rejected.map((message) => message.id), ['marker'])
  assert.deepEqual(agent.received.map((message) => message.id), ['hello'])
  assert.deepEqual(agent.notices.map((message) => message.id), ['n'])
})

test('the model follows the log like DSH: a pick is pending until a request uses it', () => {
  const session = fakeSession()
  const model = makeAgentModel(session, { provider: 'p1', model: 'm1' })
  assert.deepEqual(model.current(), { provider: 'p1', model: 'm1' })
  model.select({ provider: 'p2', model: 'm2', reasoningEffort: 'high' })
  assert.deepEqual(model.current(), { provider: 'p2', model: 'm2', reasoningEffort: 'high' })
  session.append('request/header', { header: { config: { provider: 'p2', model: 'm2', reasoningEffort: 'high' } } })
  model.select({ provider: 'p2', model: 'm2', reasoningEffort: 'high' })
  assert.equal(session.snapshotEvents().filter((event) => event.type === 'model/selection').length, 1, 'the route in use is not picked again')
})

test('titles are read from the log, else from the session object, and refreshed by the fake title model', async () => {
  const titles = makeTitleService()
  const session = fakeSession()
  assert.equal(titles.get(session), undefined)
  assert.equal(titles.get({ title: 'Kept', events: [] }).title, 'Kept')
  titles.rename(session, 'Chat-Person-Plan')
  assert.deepEqual(titles.get(session), { title: 'Chat-Person-Plan', source: { kind: 'user' }, messageSeqs: [] })
  session.nextGeneratedTitle = 'Weekend plans'
  assert.equal((await titles.refresh(session)).title, 'Weekend plans')
  titles.registration = undefined
  session.append('user/message', { content: [{ type: 'text', text: 'please book the train for Friday morning' }], source: { kind: 'user' } })
  assert.equal((await titles.refresh(session)).title, 'please book the train for')
  assert.deepEqual(titles.refreshed, ['s1', 's1'])
})
