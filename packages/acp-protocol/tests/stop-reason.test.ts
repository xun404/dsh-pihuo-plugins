import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { acpStopReason } from '../src/stop-reason.js'
import { pickAutoPermission } from '../src/permission.js'

describe('acpStopReason', () => {
  it('maps known ACP reasons', () => {
    assert.equal(acpStopReason('end_turn'), 'completed')
    assert.equal(acpStopReason('max_tokens'), 'max-tokens')
    assert.equal(acpStopReason('refusal'), 'refusal')
    assert.equal(acpStopReason('cancelled'), 'aborted')
    assert.equal(acpStopReason('max_turn_requests'), 'error')
  })
})

describe('pickAutoPermission', () => {
  const options = [
    { optionId: 'deny', kind: 'reject_once' },
    { optionId: 'ok', kind: 'allow_once' },
  ]

  it('rejects', () => {
    assert.deepEqual(pickAutoPermission('reject', options), { outcome: 'cancelled' })
  })

  it('prefers allow_once', () => {
    assert.deepEqual(pickAutoPermission('allow', options), { outcome: 'selected', optionId: 'ok' })
  })
})
