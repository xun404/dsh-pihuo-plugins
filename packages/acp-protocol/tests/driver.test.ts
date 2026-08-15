import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { AcpSessionDriver } from '../src/driver.js'

const mock = fileURLToPath(new URL('../bin/mock-acp-agent.mjs', import.meta.url))

async function withDriver(
  env: NodeJS.ProcessEnv,
  run: (drv: AcpSessionDriver) => Promise<void>,
): Promise<void> {
  const child = spawn(process.execPath, [mock], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  if (child.stdin === null || child.stdout === null) throw new Error('stdio')
  try {
    const drv = await AcpSessionDriver.connect({
      cwd: process.cwd(),
      permission: 'allow',
      stdin: child.stdin,
      stdout: child.stdout,
    })
    await drv.sessionNew()
    await run(drv)
  } finally {
    child.kill('SIGTERM')
    await new Promise<void>((resolve) => child.once('exit', () => resolve()))
  }
}

describe('AcpSessionDriver', () => {
  it('collects assistant text and maps end_turn', async () => {
    await withDriver({ MOCK_TEXT: 'hello-worker' }, async (drv) => {
      const result = await drv.prompt('go')
      assert.equal(result.ok, true)
      assert.equal(result.output, 'hello-worker')
      assert.equal(result.stopReason, 'completed')
    })
  })

  it('auto-allows a permission request under policy allow', async () => {
    await withDriver({ MOCK_TEXT: 'after-perm', MOCK_PERMISSION: '1' }, async (drv) => {
      const result = await drv.prompt('go')
      assert.equal(result.ok, true)
      assert.equal(result.output, 'after-perm')
    })
  })

  it('cancels a hanging prompt', async () => {
    await withDriver({ MOCK_HANG: '1', MOCK_TEXT: 'partial' }, async (drv) => {
      const ac = new AbortController()
      const pending = drv.prompt('go', ac.signal)
      await new Promise((r) => setTimeout(r, 80))
      ac.abort()
      const result = await pending
      assert.equal(result.ok, false)
      assert.equal(result.stopReason, 'aborted')
    })
  })
})
