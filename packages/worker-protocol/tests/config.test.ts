import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  decodeWorkerUserFile,
  encodeWorkerUserFile,
  mergeWorkerConfig,
  parseWorkerUserConfig,
} from '../src/config.ts'

describe('parseWorkerUserConfig', () => {
  it('fills defaults and requires a real command', () => {
    const missing = parseWorkerUserConfig({})
    assert.ok('issues' in missing)

    const nodeBare = parseWorkerUserConfig({ command: 'node' })
    assert.ok('issues' in nodeBare)

    const ok = parseWorkerUserConfig({ command: 'opencode', args: ['acp'] })
    assert.ok('value' in ok)
    assert.equal(ok.value.enabled, true)
    assert.equal(ok.value.poolMax, 4)
  })

  it('clamps poolMax', () => {
    const ok = parseWorkerUserConfig({ command: 'opencode', poolMax: 99 })
    assert.ok('value' in ok)
    assert.equal(ok.value.poolMax, 16)
  })

  it('allows inert node+empty args when disabled', () => {
    const ok = parseWorkerUserConfig({ enabled: false, command: 'node', args: [] })
    assert.ok('value' in ok)
    assert.equal(ok.value.enabled, false)
    assert.equal(ok.value.command, 'node')
  })
})

describe('workers.json', () => {
  it('round-trips a v2 roster', () => {
    const parsed = parseWorkerUserConfig({ command: 'node', args: ['agent.js'] })
    assert.ok('value' in parsed)
    const text = encodeWorkerUserFile([{
      ...parsed.value,
      id: 'default',
      title: 'Default',
      trusted: true,
    }], 3)
    const back = decodeWorkerUserFile(text)
    assert.ok('value' in back)
    assert.equal(back.value.version, 2)
    assert.equal(back.value.revision, 3)
    assert.equal(back.value.workers[0]?.command, 'node')
    assert.deepEqual([...(back.value.workers[0]?.args ?? [])], ['agent.js'])
  })

  it('upgrades a v1 flat object to one default row', () => {
    const back = decodeWorkerUserFile(JSON.stringify({
      version: 1,
      revision: 4,
      config: { command: 'opencode', args: ['acp'] },
    }))
    assert.ok('value' in back)
    assert.equal(back.value.version, 2)
    assert.equal(back.value.revision, 4)
    assert.equal(back.value.workers.length, 1)
    assert.equal(back.value.workers[0]?.id, 'default')
    assert.equal(back.value.workers[0]?.trusted, true)
    assert.equal(back.value.workers[0]?.command, 'opencode')
  })

  it('rejects duplicate ids', () => {
    const back = decodeWorkerUserFile(JSON.stringify({
      version: 2,
      workers: [
        { id: 'a', command: 'opencode', args: ['acp'] },
        { id: 'a', command: 'opencode', args: ['acp'] },
      ],
    }))
    assert.ok('issues' in back)
  })
})

describe('mergeWorkerConfig', () => {
  it('lets the overlay win', () => {
    const merged = mergeWorkerConfig({ command: 'node', args: ['a.js'] }, { poolMax: 2 })
    assert.ok('value' in merged)
    assert.equal(merged.value.command, 'node')
    assert.equal(merged.value.poolMax, 2)
  })
})
