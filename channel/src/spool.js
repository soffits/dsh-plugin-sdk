/**
 * File spool for requests from outside the Host process (a bridge's command
 * line, a scheduled job): a sender writes one request file, the running
 * plugin handles it and writes a result file next to it. Senders need no network access to the
 * Host, only write access to the DSH home, and requests wait while the bot is
 * stopped.
 */
import { randomUUID } from 'node:crypto'
import { watch } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Result files older than this are removed by the plugin. */
const RESULT_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Write one request atomically.
 * @param request - `{ op, ... }`.
 * @param dir - spool directory.
 * @returns the request id.
 */
export async function enqueue(request, dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const id = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const temporary = join(dir, `${id}.tmp`)
  await writeFile(temporary, JSON.stringify({ ...request, id, createdAt: Date.now() }) + '\n', { mode: 0o600 })
  await rename(temporary, join(dir, `${id}.json`))
  return id
}

/**
 * Wait for the plugin's result for one request.
 * @param id - request id from {@link enqueue}.
 * @param timeoutMs - how long to wait.
 * @param dir - spool directory.
 * @returns the result document, or undefined after the timeout.
 */
export async function waitForResult(id, timeoutMs, dir) {
  const path = join(dir, `${id}.result.json`)
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const result = JSON.parse(await readFile(path, 'utf8'))
      await rm(path, { force: true })
      return result
    } catch {
      // Not written yet.
    }
    if (Date.now() >= deadline) return undefined
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

/**
 * Remove a request that was never picked up.
 * @param id - request id.
 * @param dir - spool directory.
 * @returns true when it was still waiting and is gone now.
 */
export async function withdraw(id, dir) {
  try {
    await rm(join(dir, `${id}.json`))
    return true
  } catch {
    return false
  }
}

/**
 * Plugin side: handle spooled requests one at a time.
 * @param options - `{ dir, handle, ready, onError, intervalMs }`: `handle`
 *   resolves one request to its result; `ready` says whether requests can be
 *   handled now.
 * @returns `{ start, stop, drain }`.
 */
export function createSpool({ dir, handle, ready, onError, intervalMs = 1000 }) {
  let timer
  let watcher
  let draining
  let again = false
  let running = false

  async function recover() {
    for (const name of await readdir(dir).catch(() => [])) {
      if (name.endsWith('.processing')) {
        await rename(join(dir, name), join(dir, name.replace(/\.processing$/u, '.json'))).catch(() => {})
      }
    }
  }

  async function sweep(names) {
    for (const name of names) {
      if (!name.endsWith('.result.json') && !name.endsWith('.tmp')) continue
      const path = join(dir, name)
      const info = await stat(path).catch(() => undefined)
      if (info !== undefined && Date.now() - info.mtimeMs > RESULT_TTL_MS) await rm(path, { force: true })
    }
  }

  async function drainOnce() {
    if (!ready()) return
    const names = (await readdir(dir).catch(() => [])).sort()
    await sweep(names)
    for (const name of names) {
      if (!name.endsWith('.json') || name.endsWith('.result.json')) continue
      if (!ready()) return
      const id = name.slice(0, -'.json'.length)
      const claimed = join(dir, `${id}.processing`)
      try {
        await rename(join(dir, name), claimed)
      } catch {
        continue
      }
      let outcome
      try {
        const request = JSON.parse(await readFile(claimed, 'utf8'))
        outcome = { ok: true, result: await handle(request) }
      } catch (error) {
        outcome = { ok: false, error: typeof error?.message === 'string' ? error.message : String(error) }
      }
      try {
        // The claim goes before the result shows: a stop in between loses
        // only the confirmation, never sends the request twice.
        const pending = join(dir, `${id}.result.tmp`)
        await writeFile(pending, JSON.stringify(outcome) + '\n', { mode: 0o600 })
        await rm(claimed, { force: true })
        await rename(pending, join(dir, `${id}.result.json`))
      } catch (error) {
        onError(error)
      }
    }
  }

  function drain() {
    if (draining !== undefined) {
      again = true
      return draining
    }
    draining = (async () => {
      do {
        again = false
        await drainOnce()
      } while (again)
    })().catch(onError).finally(() => { draining = undefined })
    return draining
  }

  async function start() {
    if (running) return
    running = true
    await mkdir(dir, { recursive: true, mode: 0o700 })
    await recover()
    // Stopped while getting ready.
    if (!running) return
    try {
      watcher = watch(dir, () => { void drain() })
      watcher.on('error', () => {})
    } catch {
      // The interval still picks requests up.
    }
    timer = setInterval(() => { void drain() }, intervalMs)
    timer.unref?.()
    void drain()
  }

  function stop() {
    running = false
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
    watcher?.close()
    watcher = undefined
  }

  return { start, stop, drain }
}
