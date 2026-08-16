import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkerReuseKey } from '@pihuo/dsh-worker-protocol'
import { PoolFullError, WorkerSessionPool, type PooledSession } from '../src/pool.ts'

function key(over: Partial<WorkerReuseKey> = {}): WorkerReuseKey {
  return {
    parentSessionId: 'p',
    workerId: 'default',
    revision: '1',
    cwd: '/tmp',
    fingerprint: 'f',
    ...over,
  }
}

function fakeSession(label: string, created: string[]): PooledSession {
  const session: PooledSession = {
    async prompt() {
      return { ok: true, output: label, stopReason: 'completed' }
    },
    async cancel() {},
    async dispose() {
      created.push(`dispose:${label}`)
    },
  }
  created.push(`create:${label}`)
  return session
}

describe('WorkerSessionPool', () => {
  it('reuses an idle session for the same key', async () => {
    const created: string[] = []
    let n = 0
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 2 })
    const factory = {
      async create() {
        n += 1
        return fakeSession(String(n), created)
      },
    }
    const a = await pool.acquire(key(), factory)
    assert.equal((await a.prompt('x')).output, '1')
    pool.release(a)
    const b = await pool.acquire(key(), factory)
    assert.equal((await b.prompt('y')).output, '1')
    pool.release(b)
    assert.equal(n, 1)
    await pool.disposeAll()
  })

  it('spawns a new session when revision changes', async () => {
    const created: string[] = []
    let n = 0
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 4 })
    const factory = {
      async create() {
        n += 1
        return fakeSession(String(n), created)
      },
    }
    const a = await pool.acquire(key({ revision: '1' }), factory)
    pool.release(a)
    const b = await pool.acquire(key({ revision: '2' }), factory)
    assert.equal((await b.prompt('x')).output, '2')
    assert.equal(n, 2)
    await pool.disposeAll()
  })

  it('fails when the pool is full of busy sessions', async () => {
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 1 })
    const factory = {
      async create() {
        return fakeSession('busy', [])
      },
    }
    const a = await pool.acquire(key(), factory)
    await assert.rejects(() => pool.acquire(key({ fingerprint: 'other' }), factory), PoolFullError)
    pool.release(a)
    await pool.disposeAll()
  })

  it('evicts the least-recent idle entry to make room', async () => {
    const disposed: string[] = []
    let n = 0
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 1 })
    const factory = {
      async create() {
        n += 1
        return fakeSession(String(n), disposed)
      },
    }
    const a = await pool.acquire(key({ fingerprint: 'a' }), factory)
    pool.release(a)
    const b = await pool.acquire(key({ fingerprint: 'b' }), factory)
    assert.equal((await b.prompt('x')).output, '2')
    assert.ok(disposed.includes('dispose:1'))
    pool.release(b)
    await pool.disposeAll()
  })

  it('serializes two acquires of the same key onto one session', async () => {
    let n = 0
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 2 })
    const factory = {
      async create() {
        n += 1
        return fakeSession(String(n), [])
      },
    }
    const first = pool.acquire(key(), factory)
    const second = pool.acquire(key(), factory)
    const a = await first
    assert.equal(n, 1)
    pool.release(a)
    const b = await second
    assert.equal((await b.prompt('x')).output, '1')
    assert.equal(n, 1)
    pool.release(b)
    await pool.disposeAll()
  })

  it('evicts an idle entry when the idle TTL fires', async () => {
    const disposed: string[] = []
    const pending: Array<() => void> = []
    const pool = new WorkerSessionPool({
      idleTtlMs: 10,
      poolMax: 2,
      schedule: (fn) => {
        pending.push(fn)
        return () => {}
      },
    })
    const a = await pool.acquire(key(), {
      async create() {
        return fakeSession('ttl', disposed)
      },
    })
    pool.release(a)
    assert.equal(pool.size, 1)
    const fire = pending[0]
    assert.ok(fire !== undefined)
    fire()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(pool.size, 0)
    assert.ok(disposed.includes('dispose:ttl'))
  })

  it('wakes a queued acquire when create fails', async () => {
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 2 })
    let calls = 0
    const factory = {
      async create() {
        calls += 1
        throw new Error('spawn failed')
      },
    }
    const first = pool.acquire(key(), factory)
    const second = pool.acquire(key(), factory)
    await assert.rejects(first, /spawn failed/)
    await assert.rejects(second)
    assert.equal(pool.size, 0)
    assert.ok(calls >= 1)
  })

  it('disposeParent drops matching entries', async () => {
    const disposed: string[] = []
    const pool = new WorkerSessionPool({ idleTtlMs: 60_000, poolMax: 4 })
    const factory = {
      async create() {
        return fakeSession('s', disposed)
      },
    }
    const a = await pool.acquire(key({ parentSessionId: 'one' }), factory)
    pool.release(a)
    await pool.disposeParent('one')
    assert.ok(disposed.includes('dispose:s'))
    assert.equal(pool.size, 0)
  })
})
