import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { readRoster, writeRoster } from '../src/store.ts'
import type { Config } from '../src/config.ts'

const plugin: Config = {
  providerName: 'pihuo-acp',
  command: 'node',
  args: ['mock.js'],
  env: {},
  disposeGraceMs: 3000,
}

describe('workers store', () => {
  it('uses a default row from plugin config when the file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-store-'))
    try {
      const effective = readRoster(plugin, { DSH_HOME: dir })
      assert.equal(effective.revision, 0)
      assert.equal(effective.workers.length, 1)
      assert.equal(effective.workers[0]?.id, 'default')
      assert.equal(effective.workers[0]?.command, 'node')
      assert.equal(effective.workers[0]?.trusted, true)
      assert.deepEqual([...(effective.workers[0]?.args ?? [])], ['mock.js'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('writes a roster and bumps revision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-store-'))
    try {
      const env = { DSH_HOME: dir }
      const saved = writeRoster(plugin, [{
        id: 'opencode',
        title: 'OpenCode',
        trusted: true,
        command: 'opencode',
        args: ['acp'],
      }], env)
      assert.equal(saved.revision, 1)
      assert.equal(saved.workers[0]?.id, 'opencode')
      const again = readRoster(plugin, env)
      assert.equal(again.revision, 1)
      assert.equal(again.workers[0]?.command, 'opencode')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
