import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodeChatTeam, encodeChatTeam, parseChatTeam } from '../src/team.ts'

describe('parseChatTeam', () => {
  it('accepts an empty team', () => {
    const parsed = parseChatTeam({ sessionId: 's1', members: [] })
    assert.ok('value' in parsed)
    assert.equal(parsed.value.members.length, 0)
  })

  it('rejects a duplicate worker and allows the same role on two workers', () => {
    const dupWorker = parseChatTeam({
      sessionId: 's1',
      members: [
        { workerId: 'opencode', role: 'coder' },
        { workerId: 'opencode', role: 'review' },
      ],
    })
    assert.ok('issues' in dupWorker)

    const sameRole = parseChatTeam({
      sessionId: 's1',
      members: [
        { workerId: 'opencode', role: 'coder' },
        { workerId: 'codex', role: 'coder' },
      ],
    })
    assert.ok('value' in sameRole)
    assert.equal(sameRole.value.members.length, 2)
  })

  it('round-trips', () => {
    const text = encodeChatTeam({
      sessionId: 's1',
      members: [{ workerId: 'opencode', role: 'coder', model: 'flash', reasoning: 'high' }],
    })
    const back = decodeChatTeam(text)
    assert.ok('value' in back)
    assert.equal(back.value.members[0]?.reasoning, 'high')
  })
})
