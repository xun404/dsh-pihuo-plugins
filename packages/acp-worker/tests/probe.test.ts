import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { probeCommand } from '../src/probe.ts'

describe('probeCommand', () => {
  it('finds node on PATH', () => {
    const hit = probeCommand(process.execPath)
    assert.equal(hit.found, true)
    assert.equal(hit.path, process.execPath)
  })

  it('misses a junk name', () => {
    const hit = probeCommand('pihuo-definitely-not-an-executable-xyz')
    assert.equal(hit.found, false)
  })
})
