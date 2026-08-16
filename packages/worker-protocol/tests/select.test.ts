import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkerRosterEntry } from '../src/config.ts'
import { parseDispatchHint, parseWorkerIdHint, resolveDispatch, resolveRosterWorker, stripWorkerIdLine } from '../src/select.ts'

function row(over: Partial<WorkerRosterEntry> & { id: string }): WorkerRosterEntry {
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

describe('parseWorkerIdHint', () => {
  it('reads the first prompt line and a legal label', () => {
    assert.equal(parseWorkerIdHint('workerId: opencode\ndo the thing'), 'opencode')
    assert.equal(parseWorkerIdHint('hello', 'opencode'), 'opencode')
    assert.equal(parseWorkerIdHint('hello', 'Not An Id'), undefined)
  })
})

describe('parseDispatchHint', () => {
  it('reads workerId and role lines', () => {
    assert.deepEqual(parseDispatchHint('role: coder\nworkerId: opencode\ndo it'), {
      workerId: 'opencode',
      role: 'coder',
    })
    assert.deepEqual(parseDispatchHint('role: review\ndo it'), { role: 'review' })
  })

  it('reads a Chinese 角色 line and a role label', () => {
    assert.deepEqual(parseDispatchHint('角色：编码\n做这个'), { role: 'coder' })
    assert.deepEqual(parseDispatchHint('do it', 'coder'), { role: 'coder' })
  })
})

describe('stripWorkerIdLine', () => {
  it('drops only the hint line', () => {
    assert.equal(stripWorkerIdLine('workerId: opencode\ndo the thing'), 'do the thing')
    assert.equal(stripWorkerIdLine('role: coder\ndo the thing'), 'do the thing')
    assert.equal(stripWorkerIdLine('do the thing'), 'do the thing')
  })
})

describe('resolveDispatch', () => {
  const roster = [
    row({ id: 'opencode' }),
    row({ id: 'codex' }),
  ]

  it('resolves a role through the team and inherits overrides', () => {
    const hit = resolveDispatch(
      roster,
      [{ workerId: 'opencode', role: 'coder', reasoning: 'high' }],
      { role: 'coder' },
    )
    assert.ok('value' in hit)
    assert.equal(hit.value.worker.id, 'opencode')
    assert.equal(hit.value.reasoning, 'high')
  })

  it('uses the only team member without a hint', () => {
    const hit = resolveDispatch(roster, [{ workerId: 'codex', role: 'review' }], {})
    assert.ok('value' in hit)
    assert.equal(hit.value.worker.id, 'codex')
  })

  it('requires a hint when several members are seated', () => {
    const hit = resolveDispatch(
      roster,
      [
        { workerId: 'opencode', role: 'coder' },
        { workerId: 'codex', role: 'review' },
      ],
      {},
    )
    assert.ok('issues' in hit)
  })

  it('requires workerId when the same role is bound to several workers', () => {
    const hit = resolveDispatch(
      roster,
      [
        { workerId: 'opencode', role: 'coder' },
        { workerId: 'codex', role: 'coder' },
      ],
      { role: 'coder' },
    )
    assert.ok('issues' in hit)
    const named = resolveDispatch(
      roster,
      [
        { workerId: 'opencode', role: 'coder' },
        { workerId: 'codex', role: 'coder' },
      ],
      { workerId: 'codex' },
    )
    assert.ok('value' in named)
    assert.equal(named.value.worker.id, 'codex')
  })
})

describe('resolveRosterWorker', () => {
  const roster = [
    row({ id: 'default', command: 'node', args: ['a.js'] }),
    row({ id: 'opencode' }),
    row({ id: 'off', enabled: false }),
    row({ id: 'shy', trusted: false }),
  ]

  it('honors an explicit hint', () => {
    const hit = resolveRosterWorker(roster, 'opencode')
    assert.ok('value' in hit)
    assert.equal(hit.value.id, 'opencode')
  })

  it('refuses disabled or untrusted hints', () => {
    assert.ok('issues' in resolveRosterWorker(roster, 'off'))
    assert.ok('issues' in resolveRosterWorker(roster, 'shy'))
    assert.ok('issues' in resolveRosterWorker(roster, 'missing'))
  })

  it('falls back to default when several rows are ready', () => {
    const hit = resolveRosterWorker(roster)
    assert.ok('value' in hit)
    assert.equal(hit.value.id, 'default')
  })

  it('uses the only ready row when default is not ready', () => {
    const hit = resolveRosterWorker([
      row({ id: 'default', enabled: false }),
      row({ id: 'opencode' }),
    ])
    assert.ok('value' in hit)
    assert.equal(hit.value.id, 'opencode')
  })
})
