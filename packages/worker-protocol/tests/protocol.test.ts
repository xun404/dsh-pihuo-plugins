import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkerReuseKey } from '../src/index.ts'

describe('worker-protocol', () => {
  it('exposes a reuse-key shape tests can construct', () => {
    const key: WorkerReuseKey = {
      parentSessionId: 's',
      workerId: 'opencode',
      revision: '1',
      cwd: '/tmp',
      fingerprint: 'abc',
    }
    assert.equal(key.workerId, 'opencode')
  })
})
