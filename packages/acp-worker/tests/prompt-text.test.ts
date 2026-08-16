import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeActivityTrailer, leaderTeamPrompt, selectedPreset } from '../src/prompt-text.ts'
import type { WorkerRosterEntry } from '@pihuo/dsh-worker-protocol'

function worker(over: Partial<WorkerRosterEntry> & { id: string }): WorkerRosterEntry {
  return {
    enabled: true,
    trusted: true,
    title: over.id,
    command: 'opencode',
    args: ['acp'],
    idleTtlMs: 300_000,
    poolMax: 4,
    ...over,
  }
}

describe('leaderTeamPrompt', () => {
  it('is empty for a non-leader preset', () => {
    assert.equal(leaderTeamPrompt('standard', { sessionId: 's', members: [] }, []), '')
  })

  it('lists seated members without command lines', () => {
    const text = leaderTeamPrompt(
      'pihuo-leader',
      { sessionId: 's', members: [{ workerId: 'opencode', role: 'coder' }] },
      [worker({ id: 'opencode', title: 'OpenCode', model: 'flash', reasoning: 'high' })],
    )
    assert.match(text, /coder → OpenCode/)
    assert.match(text, /flash/)
    assert.match(text, /high/)
    assert.doesNotMatch(text, /opencode acp/)
  })

  it('lists registered workers so the Leader can form a team without a header pin', () => {
    const text = leaderTeamPrompt('pihuo-leader', { sessionId: 's', members: [] }, [worker({ id: 'opencode', title: 'OpenCode' })])
    assert.match(text, /Registered workers/)
    assert.match(text, /OpenCode \(opencode\)/)
    assert.match(text, /Forming a team means calling acp_worker/)
    assert.doesNotMatch(text, /Ask the user to assign/)
  })
})

describe('selectedPreset', () => {
  it('reads the last agent-preset/selected event', () => {
    assert.equal(selectedPreset([
      { type: 'agent-preset/selected', data: { agentPreset: 'standard' } },
      { type: 'agent-preset/selected', data: { agentPreset: 'pihuo-leader' } },
    ]), 'pihuo-leader')
  })
})

describe('encodeActivityTrailer', () => {
  it('omits an empty list', () => {
    assert.equal(encodeActivityTrailer([]), '')
  })
})
