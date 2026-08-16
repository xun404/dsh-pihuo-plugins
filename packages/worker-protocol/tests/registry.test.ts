import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseAcpRegistry, projectRegistryAgent } from '../src/registry.ts'

const opencode = {
  id: 'opencode',
  name: 'OpenCode',
  version: '1.18.18',
  description: 'The open source coding agent',
  distribution: {
    binary: {
      'darwin-aarch64': { cmd: './opencode', args: ['acp'] },
    },
  },
}

const claude = {
  id: 'claude-acp',
  name: 'Claude Agent',
  version: '0.68.0',
  description: 'ACP wrapper for Anthropic\'s Claude',
  authors: ['Anthropic', 'Zed Industries'],
  repository: 'https://github.com/agentclientprotocol/claude-agent-acp',
  icon: 'https://cdn.agentclientprotocol.com/registry/v1/latest/claude-acp.svg',
  distribution: {
    npx: { package: '@agentclientprotocol/claude-agent-acp@0.68.0' },
  },
}

describe('projectRegistryAgent', () => {
  it('prefers a platform binary basename over npx', () => {
    const both = {
      ...opencode,
      distribution: {
        ...opencode.distribution,
        npx: { package: 'opencode@1.0.0', args: ['acp'] },
      },
    }
    const row = projectRegistryAgent(both, 'darwin-aarch64')
    assert.ok(row !== undefined)
    assert.equal(row.command, 'opencode')
    assert.deepEqual([...row.args], ['acp'])
    assert.equal(row.distribution, 'binary')
  })

  it('projects npx as the local command the user must have', () => {
    const row = projectRegistryAgent(claude, 'darwin-aarch64')
    assert.ok(row !== undefined)
    assert.equal(row.command, 'claude-agent-acp')
    assert.equal(row.packageSpec, '@agentclientprotocol/claude-agent-acp@0.68.0')
    assert.deepEqual([...row.args], [])
    assert.equal(row.distribution, 'npx')
    assert.equal(row.icon, claude.icon)
    assert.deepEqual([...(row.authors ?? [])], ['Anthropic', 'Zed Industries'])
    assert.equal(row.repository, claude.repository)
  })

  it('drops icons that are not on the official CDN', () => {
    const row = projectRegistryAgent({
      ...claude,
      icon: 'https://evil.example/x.svg',
    }, 'darwin-aarch64')
    assert.ok(row !== undefined)
    assert.equal(row.icon, undefined)
  })

  it('skips a binary-only agent on the wrong platform', () => {
    assert.equal(projectRegistryAgent(opencode, 'linux-x86_64'), undefined)
  })

  it('projects uvx as the local command plus agent args', () => {
    const row = projectRegistryAgent({
      id: 'fast-agent',
      name: 'fast-agent',
      version: '0.10.1',
      description: 'Code and build agents',
      distribution: { uvx: { package: 'fast-agent-acp==0.10.1', args: ['-x'] } },
    }, 'darwin-aarch64')
    assert.ok(row !== undefined)
    assert.equal(row.command, 'fast-agent-acp')
    assert.deepEqual([...row.args], ['-x'])
    assert.equal(row.distribution, 'uvx')
  })
})

describe('parseAcpRegistry', () => {
  it('keeps official ids and drops junk', () => {
    const parsed = parseAcpRegistry({
      version: '1.0.0',
      agents: [opencode, claude, { id: 'broken' }, 'nope'],
    }, 'darwin-aarch64')
    assert.ok('catalog' in parsed)
    assert.equal(parsed.version, '1.0.0')
    assert.equal(parsed.catalog.length, 2)
    assert.equal(parsed.catalog[0]?.id, 'opencode')
    assert.equal(parsed.catalog[1]?.id, 'claude-acp')
  })

  it('rejects a non-object', () => {
    assert.ok('issues' in parseAcpRegistry([]))
  })
})
