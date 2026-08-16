import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadOfficialCatalog, registryLkgPath } from '../src/registry-load.ts'

const registryDoc = {
  version: '1.0.0',
  agents: [
    {
      id: 'claude-acp',
      name: 'Claude Agent',
      version: '0.68.0',
      description: 'ACP wrapper for Anthropic\'s Claude',
      distribution: { npx: { package: '@agentclientprotocol/claude-agent-acp@0.68.0' } },
    },
    {
      id: 'fast-agent',
      name: 'fast-agent',
      version: '0.10.1',
      description: 'Code and build agents',
      distribution: { uvx: { package: 'fast-agent-acp==0.10.1', args: ['-x'] } },
    },
  ],
}

function envFor(dir: string): NodeJS.ProcessEnv {
  return { ...process.env, DSH_HOME: dir }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('loadOfficialCatalog', () => {
  it('uses live JSON and writes LKG', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-reg-'))
    try {
      const loaded = await loadOfficialCatalog(envFor(dir), async () => jsonResponse(registryDoc))
      assert.equal(loaded.source, 'live')
      assert.equal(loaded.version, '1.0.0')
      assert.equal(loaded.catalog.some(row => row.id === 'custom'), false)
      assert.ok(loaded.catalog.some(row => row.id === 'claude-acp' && row.command === 'claude-agent-acp'))
      assert.ok(loaded.catalog.some(row => row.id === 'fast-agent' && row.command === 'fast-agent-acp'))
      const lkg = registryLkgPath(envFor(dir))
      assert.equal(existsSync(lkg), true)
      assert.equal(JSON.parse(readFileSync(lkg, 'utf8')).version, '1.0.0')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to LKG when fetch fails', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-reg-'))
    try {
      const lkg = registryLkgPath(envFor(dir))
      mkdirSync(join(dir, 'pihuo'), { recursive: true })
      writeFileSync(lkg, `${JSON.stringify(registryDoc)}\n`)
      const loaded = await loadOfficialCatalog(envFor(dir), async () => {
        throw new Error('offline')
      })
      assert.equal(loaded.source, 'lkg')
      assert.ok(loaded.catalog.some(row => row.id === 'claude-acp'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to bundled templates when live and LKG are empty', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-reg-'))
    try {
      const loaded = await loadOfficialCatalog(envFor(dir), async () => jsonResponse({ version: '0', agents: [] }))
      assert.equal(loaded.source, 'bundled')
      assert.ok(loaded.catalog.some(row => row.id === 'opencode'))
      assert.equal(loaded.catalog.some(row => row.id === 'custom'), false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
