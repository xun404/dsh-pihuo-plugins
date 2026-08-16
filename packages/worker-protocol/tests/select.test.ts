import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkerRosterEntry } from '../src/config.ts'
import { parseWorkerIdHint, resolveRosterWorker, stripWorkerIdLine } from '../src/select.ts'

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
    assert.equal(parseWorkerIdHint('hello', 'coder'), 'coder')
    assert.equal(parseWorkerIdHint('hello', 'Not An Id'), undefined)
  })
})

describe('stripWorkerIdLine', () => {
  it('drops only the hint line', () => {
    assert.equal(stripWorkerIdLine('workerId: opencode\ndo the thing'), 'do the thing')
    assert.equal(stripWorkerIdLine('do the thing'), 'do the thing')
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
