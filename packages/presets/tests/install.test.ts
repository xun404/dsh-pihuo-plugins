import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  PACKAGED_PRESET_IDS,
  installPackagedPresets,
  name,
  packagedPresetRoot,
  userPresetRoot,
} from '../src/index.ts'

describe('pihuo-presets', () => {
  it('uses a stable plugin name and preset id', () => {
    assert.equal(name, 'pihuo-presets')
    assert.deepEqual([...PACKAGED_PRESET_IDS], ['pihuo-leader'])
  })

  it('honors DSH_HOME for the user roster', () => {
    assert.equal(userPresetRoot({ DSH_HOME: '/tmp/dsh-home' }), '/tmp/dsh-home/.agent-presets')
  })

  it('copies pihuo-leader into a roster root', () => {
    const dest = mkdtempSync(join(tmpdir(), 'pihuo-presets-'))
    try {
      const installed = installPackagedPresets(dest)
      assert.equal(installed.length, 1)
      const dir = join(dest, 'pihuo-leader')
      const yml = readFileSync(join(dir, 'agent.cordis.yml'), 'utf8')
      assert.match(yml, /toolName: acp_worker/)
      assert.match(yml, /provider: pihuo-acp/)
      assert.match(readFileSync(join(dir, 'preset.yml'), 'utf8'), /PiHuo Leader/)
      assert.equal(packagedPresetRoot().endsWith('presets'), true)
    } finally {
      rmSync(dest, { recursive: true, force: true })
    }
  })
})
