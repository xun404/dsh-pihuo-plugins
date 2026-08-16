import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { locateWorkerCommand, missingPlatformOptionals, validatePackageSpec } from '../src/install.ts'

describe('validatePackageSpec', () => {
  it('accepts scoped npm and uv versions', () => {
    assert.equal(validatePackageSpec('@agentclientprotocol/claude-agent-acp@0.68.0'), true)
    assert.equal(validatePackageSpec('fast-agent-acp==0.10.1'), true)
    assert.equal(validatePackageSpec('opencode'), true)
  })

  it('rejects paths and shell', () => {
    assert.equal(validatePackageSpec('../evil'), false)
    assert.equal(validatePackageSpec('a b'), false)
    assert.equal(validatePackageSpec('pkg;rm'), false)
  })
})

describe('locateWorkerCommand', () => {
  it('ignores PATH for npx catalog rows', () => {
    const previous = process.env.DSH_HOME
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-locate-'))
    process.env.DSH_HOME = dir
    try {
      const hit = locateWorkerCommand('node', 'grok-build', { distribution: 'npx' })
      assert.equal(hit.found, false)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('finds a prefix install for npx', () => {
    const previous = process.env.DSH_HOME
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-locate-'))
    process.env.DSH_HOME = dir
    try {
      const binDir = join(dir, 'pihuo', 'agents', 'grok-build', 'node_modules', '.bin')
      mkdirSync(binDir, { recursive: true })
      const bin = join(binDir, 'grok')
      writeFileSync(bin, '#!/bin/sh\n', { mode: 0o755 })
      const hit = locateWorkerCommand('grok', 'grok-build', { distribution: 'npx' })
      assert.equal(hit.found, true)
      assert.equal(hit.path, bin)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('uses PATH for binary catalog rows', () => {
    const hit = locateWorkerCommand('node', 'opencode', { distribution: 'binary' })
    assert.equal(hit.found, true)
    assert.ok(hit.path !== undefined && hit.path !== '')
  })
})

describe('missingPlatformOptionals', () => {
  it('lists the host platform alias and skips installed ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-opt-'))
    try {
      const pkgDir = join(dir, 'node_modules', '@openai', 'codex')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
        name: '@openai/codex',
        optionalDependencies: {
          '@openai/codex-darwin-arm64': 'npm:@openai/codex@0.147.0-darwin-arm64',
          '@openai/codex-linux-x64': 'npm:@openai/codex@0.147.0-linux-x64',
        },
      }))
      const missing = missingPlatformOptionals(dir, 'darwin', 'arm64')
      assert.deepEqual(missing, ['@openai/codex-darwin-arm64@npm:@openai/codex@0.147.0-darwin-arm64'])
      mkdirSync(join(dir, 'node_modules', '@openai', 'codex-darwin-arm64'), { recursive: true })
      assert.deepEqual(missingPlatformOptionals(dir, 'darwin', 'arm64'), [])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
