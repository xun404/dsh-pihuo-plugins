import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fingerprintOf, reuseKeyId } from '../src/index.ts'

describe('fingerprintOf', () => {
  it('is stable for the same spawn identity', () => {
    const a = fingerprintOf({ command: 'node', args: ['x'], envNames: ['B', 'A'] })
    const b = fingerprintOf({ command: 'node', args: ['x'], envNames: ['A', 'B'] })
    assert.equal(a, b)
  })

  it('changes when args change', () => {
    const a = fingerprintOf({ command: 'node', args: ['x'], envNames: [] })
    const b = fingerprintOf({ command: 'node', args: ['y'], envNames: [] })
    assert.notEqual(a, b)
  })

  it('changes when reasoning changes', () => {
    const a = fingerprintOf({ command: 'node', args: ['x'], envNames: [], reasoning: 'low' })
    const b = fingerprintOf({ command: 'node', args: ['x'], envNames: [], reasoning: 'high' })
    assert.notEqual(a, b)
  })
})

describe('reuseKeyId', () => {
  it('joins fields', () => {
    const id = reuseKeyId({
      parentSessionId: 'p',
      workerId: 'w',
      revision: '1',
      cwd: '/tmp',
      fingerprint: 'f',
    })
    assert.match(id, /^p\0w\0/)
  })
})
