import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { readTeam, upsertTeamMember, writeTeam } from '../src/team-store.ts'

describe('team store', () => {
  it('missing file is an empty team', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-team-'))
    try {
      const team = readTeam('sess-1', { DSH_HOME: dir })
      assert.equal(team.members.length, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('round-trips a member', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-team-'))
    try {
      const saved = writeTeam('sess-1', {
        sessionId: 'sess-1',
        members: [{ workerId: 'opencode', role: 'coder' }],
      }, { DSH_HOME: dir })
      assert.equal(saved.lastError, undefined)
      const back = readTeam('sess-1', { DSH_HOME: dir })
      assert.equal(back.members[0]?.role, 'coder')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('upserts a new seat and ignores a second start of the same worker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-team-'))
    try {
      const env = { DSH_HOME: dir }
      const first = upsertTeamMember('sess-2', { workerId: 'opencode', role: 'coder' }, env)
      assert.equal(first.members.length, 1)
      const again = upsertTeamMember('sess-2', { workerId: 'opencode', role: 'review' }, env)
      assert.equal(again.members.length, 1)
      assert.equal(again.members[0]?.role, 'coder')
      const fromGeneral = upsertTeamMember('sess-3', { workerId: 'opencode', role: 'general' }, env)
      assert.equal(fromGeneral.members[0]?.role, 'general')
      const promoted = upsertTeamMember('sess-3', { workerId: 'opencode', role: 'coder' }, env)
      assert.equal(promoted.members[0]?.role, 'coder')
      const second = upsertTeamMember('sess-2', { workerId: 'codex', role: 'coder' }, env)
      assert.equal(second.members.length, 2)
      assert.equal(second.members[1]?.role, 'coder')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
