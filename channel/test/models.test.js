import assert from 'node:assert/strict'
import test from 'node:test'
import { createModelCatalog, effortChoices, isGoneModel, modelName, pickedSelection, sameSelection, selectSessionModel, sessionModelOf } from '../src/models.js'

test('a session that is not running reports its recorded model and releases the observation', async () => {
  let disposed = 0
  const ctx = {
    get: (name) => (name === 'sessionQuery'
      ? {
          observeSession: async () => ({
            projections: { values: { modelSelection: { lastUsed: { provider: 'example-gateway', model: 'gemini-pro-high' }, next: { provider: 'anthropic', model: 'claude-opus-5-5', reasoningEffort: 'medium' } } } },
            [Symbol.dispose]() { disposed += 1 },
          }),
        }
      : name === 'agents' ? { get: () => undefined } : undefined),
  }
  assert.deepEqual(await sessionModelOf(ctx, 'session-cold'), { provider: 'anthropic', model: 'claude-opus-5-5', reasoningEffort: 'medium' }, 'the pending choice wins over the last request')
  assert.equal(disposed, 1)
  assert.equal(await sessionModelOf(ctx, undefined), undefined)
})

test('a live agent is asked directly', async () => {
  const ctx = { get: (name) => (name === 'agents' ? { get: () => ({ model: { current: () => ({ provider: 'p', model: 'm' }) } }) } : undefined) }
  assert.deepEqual(await sessionModelOf(ctx, 'session-live'), { provider: 'p', model: 'm' })
})

test('effort choices and model picks follow the Web picker', () => {
  const model = { id: 'x', reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }
  assert.deepEqual(effortChoices(model, 'Default'), [{ id: undefined, name: 'Default' }, { id: 'low', name: 'Low' }, { id: 'high', name: 'High' }])
  assert.deepEqual(effortChoices({ id: 'y' }, 'Default'), [])
  const withDefault = { id: 'z', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }
  assert.deepEqual(pickedSelection({ provider: 'a', model: 'z', reasoningEffort: 'max' }, 'a', withDefault), { provider: 'a', model: 'z', reasoningEffort: 'max' }, 'the same model keeps its effort')
  assert.deepEqual(pickedSelection({ provider: 'a', model: 'other', reasoningEffort: 'max' }, 'a', withDefault), { provider: 'a', model: 'z', reasoningEffort: 'low' }, 'another model starts at its default')
  assert.deepEqual(pickedSelection(undefined, 'a', model), { provider: 'a', model: 'x' })
})

test('selections match on provider, model and effort', () => {
  assert.ok(sameSelection({ provider: 'a', model: 'm' }, { provider: 'a', model: 'm' }))
  assert.ok(!sameSelection({ provider: 'a', model: 'm', reasoningEffort: 'low' }, { provider: 'a', model: 'm' }))
})

test('a model the catalog dropped counts as gone, a failing provider does not', () => {
  const catalog = { groups: [{ id: 'claude-code', models: [{ id: 'opus' }] }], failures: [{ id: 'openrouter' }] }
  assert.equal(isGoneModel(catalog, { provider: 'anthropic', model: 'opus' }), true)
  assert.equal(isGoneModel(catalog, { provider: 'claude-code', model: 'old' }), true)
  assert.equal(isGoneModel(catalog, { provider: 'claude-code', model: 'opus' }), false)
  assert.equal(isGoneModel(catalog, { provider: 'openrouter', model: 'x' }), false)
  assert.equal(isGoneModel(undefined, { provider: 'anthropic', model: 'opus' }), false)
  assert.equal(isGoneModel(catalog, undefined), false)
})

test('a session switch is checked by the host and recorded by the agent, never saved as the default', async () => {
  const calls = []
  const ctx = {
    get: (name) => ({
      llm: { resolveCallConfig: async (selection) => calls.push(['resolve', selection]) },
      sessionController: { selectModel: () => calls.push(['default']) },
    })[name],
  }
  const agent = { model: { select: (selection) => calls.push(['select', selection]) } }
  await selectSessionModel(ctx, agent, { provider: 'p', model: 'm', reasoningEffort: undefined, extra: 1 })
  assert.deepEqual(calls, [['resolve', { provider: 'p', model: 'm' }], ['select', { provider: 'p', model: 'm' }]])
  const refusing = { get: () => ({ resolveCallConfig: async () => { throw new Error('no route') } }) }
  await assert.rejects(selectSessionModel(refusing, agent, { provider: 'x', model: 'y' }), /no route/)
  assert.equal(calls.length, 2, 'a model the host cannot route is not recorded')
})

test('the catalog is read once while fresh, again on request, and an outage keeps the last copy', async () => {
  let reads = 0
  let failing = false
  const controller = {
    modelCatalog: async () => {
      reads += 1
      if (failing) throw new Error('down')
      return { groups: [{ id: 'p', models: [{ id: 'm', name: 'Model M' }] }] }
    },
  }
  const catalog = createModelCatalog({ get: (name) => (name === 'sessionController' ? controller : undefined) })
  const [first, second] = await Promise.all([catalog.load(), catalog.load()])
  assert.equal(reads, 1, 'concurrent loads share one read')
  assert.equal(first, second)
  assert.deepEqual(first.failures, [])
  assert.equal(modelName(first, { provider: 'p', model: 'm' }), 'Model M')
  assert.equal(modelName(first, { provider: 'p', model: 'gone' }), 'gone')
  failing = true
  assert.equal(await catalog.load(true), first)
  assert.equal(reads, 2)
  assert.equal(await createModelCatalog({ get: () => undefined }).load(), undefined)
})
