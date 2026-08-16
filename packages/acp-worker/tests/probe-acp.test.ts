import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AcpProtocolError } from '@pihuo/dsh-acp-protocol'
import { classifyProbeFailure, resolveProbeLaunch } from '../src/probe-acp.ts'
import { binaryNameFromPackageSpec, packageSpecFromArgs } from '@pihuo/dsh-worker-protocol'

describe('package spec helpers', () => {
  it('reads npx -y package@ver', () => {
    assert.equal(packageSpecFromArgs(['-y', '@agentclientprotocol/claude-agent-acp@0.68.0']), '@agentclientprotocol/claude-agent-acp@0.68.0')
    assert.equal(binaryNameFromPackageSpec('@agentclientprotocol/claude-agent-acp@0.68.0'), 'claude-agent-acp')
    assert.equal(binaryNameFromPackageSpec('opencode@1.0.0'), 'opencode')
  })
})

describe('resolveProbeLaunch', () => {
  it('does not spawn npx for a missing ACP wrapper', () => {
    const hit = resolveProbeLaunch('npx', ['-y', '@agentclientprotocol/claude-agent-acp@0.68.0'])
    assert.deepEqual(hit, { missing: '@agentclientprotocol/claude-agent-acp@0.68.0' })
  })

  it('uses a PATH binary when the catalog row is npx for that same name', () => {
    const hit = resolveProbeLaunch('npx', ['-y', 'node@20.0.0', '-e', '0'])
    assert.equal('command' in hit && hit.command === 'node', true)
  })

  it('rejects a bare missing command', () => {
    const hit = resolveProbeLaunch('definitely-not-installed-acp-agent', [])
    assert.deepEqual(hit, { missing: 'definitely-not-installed-acp-agent' })
  })
})

describe('classifyProbeFailure', () => {
  it('maps protocol mismatch', () => {
    const hit = classifyProbeFailure(new AcpProtocolError('ACP protocol version incompatible', 'protocol_incompatible'))
    assert.equal(hit.status, 'incompatible')
    assert.equal(hit.code, 'ACP_PROTOCOL_INCOMPATIBLE')
  })

  it('maps timeout and missing runner', () => {
    const timeout = classifyProbeFailure(Object.assign(new Error('ACP initialize timed out'), { code: 'PROBE_TIMEOUT' }))
    assert.equal(timeout.code, 'PROBE_TIMEOUT')
    assert.match(timeout.message, /missing|not speak ACP/i)
    assert.equal(classifyProbeFailure(Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })).code, 'ACP_RUNNER_MISSING')
    assert.equal(classifyProbeFailure(Object.assign(new Error('gone'), { code: 'PROCESS_EXITED' })).code, 'PROCESS_EXITED')
  })

  it('maps auth_required from ACP error data', () => {
    const hit = classifyProbeFailure({ message: 'denied', data: { reason: 'auth_required' } })
    assert.equal(hit.status, 'auth_required')
    assert.equal(hit.code, 'WORKER_AUTH_REQUIRED')
    const text = classifyProbeFailure(new Error('Authentication required'))
    assert.equal(text.code, 'WORKER_AUTH_REQUIRED')
  })
})
