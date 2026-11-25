import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPeople, expandHome, personKey, viewerOf } from '../index.js'

const identity = value => ({ current: () => value })

test('person ids compare without case, width or surrounding space', () => {
  assert.equal(personKey(' Alex '), 'alex')
  assert.equal(personKey('ＡＬＥＸ'), 'alex')
  assert.equal(personKey(undefined), '')
})

test('a leading ~/ is the home folder, nothing else is touched', () => {
  assert.equal(expandHome('~/data', '/home/u'), '/home/u/data')
  assert.equal(expandHome('~', '/home/u'), '/home/u')
  assert.equal(expandHome('/srv/~/x', '/home/u'), '/srv/~/x')
  assert.equal(expandHome('~other/x', '/home/u'), '~other/x')
})

test('single owner without a mapping; a mapping needs an identity provider', async () => {
  assert.deepEqual(await viewerOf(createPeople({}), undefined), { mode: 'owner' })
  assert.deepEqual(await viewerOf(createPeople({ people: { s1: 'Kim' } }), undefined), { mode: 'people', unavailable: true })
})

test('a verified id maps to its person; an unknown or missing one to nobody', async () => {
  const people = createPeople({ people: { s1: 'Kim' } })
  assert.deepEqual(await viewerOf(people, identity({ id: 's1', name: 'Kim K.' })), { mode: 'people', person: 'kim', name: 'Kim K.' })
  assert.deepEqual(await viewerOf(people, identity({ id: 's2' })), { mode: 'people', person: undefined, name: null })
  assert.deepEqual(await viewerOf(people, identity(null)), { mode: 'people', person: undefined, name: null })
})

test('a people file is read under its key, re-read when it changes, and inline entries win', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'host-kit-'))
  try {
    const file = join(dir, 'people.json')
    await writeFile(file, JSON.stringify({ users: { s1: 'Kim', s3: 'Ola' }, other: {} }))
    const people = createPeople({ people: { s3: 'Ana' }, peopleFile: file, peopleKey: 'users' })
    assert.equal(await people.personFor('s1'), 'kim')
    assert.equal(await people.personFor('s3'), 'ana')
    await new Promise(resolve => setTimeout(resolve, 20))
    await writeFile(file, JSON.stringify({ users: { s1: 'Lee', s2: 'Kim' } }))
    assert.equal(await people.personFor('s1'), 'lee')
    assert.equal(await people.personFor('s2'), 'kim')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a broken or missing people file maps nobody, reported once per change', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'host-kit-'))
  try {
    const file = join(dir, 'people.json')
    await writeFile(file, '{')
    const warnings = []
    const people = createPeople({ peopleFile: file }, { warn: message => warnings.push(message) })
    assert.equal(people.enabled, true)
    assert.equal(await people.personFor('s1'), undefined)
    assert.equal(await people.personFor('s1'), undefined)
    assert.equal(warnings.length, 1)
    await writeFile(file, '[]')
    assert.equal(await people.personFor('s1'), undefined)
    assert.equal(warnings.length, 2)
    const gone = createPeople({ peopleFile: join(dir, 'none.json') }, { warn: message => warnings.push(message) })
    assert.equal(await gone.personFor('s1'), undefined)
    assert.equal(warnings.length, 3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
