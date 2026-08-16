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

  it('collects thought and tool updates during prompt', async () => {
    const seen: string[] = []
    await withDriver({ MOCK_TEXT: 'done', MOCK_THINK: 'hmm', MOCK_TOOL: 'read' }, async (drv) => {
      const result = await drv.prompt('go', undefined, (activity) => {
        seen.push(`${activity.kind}:${activity.text}`)
      })
      assert.equal(result.ok, true)
      assert.equal(result.output, 'done')
      assert.ok(result.activities.some(row => row.kind === 'thought' && row.text === 'hmm'))
      assert.ok(result.activities.some(row => row.kind === 'tool' && row.toolTitle === 'read'))
      assert.ok(seen.some(row => row.startsWith('thought:')))
    })
  })

  it('auto-allows a permission request under policy allow', async () => {
    await withDriver({ MOCK_TEXT: 'after-perm', MOCK_PERMISSION: '1' }, async (drv) => {
      const result = await drv.prompt('go')
      assert.equal(result.ok, true)
      assert.equal(result.output, 'after-perm')
    })
  })

  it('asks through askPermission and then completes', async () => {
    const child = spawn(process.execPath, [mock], {
      env: { ...process.env, MOCK_TEXT: 'asked', MOCK_PERMISSION: '1' },
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    if (child.stdin === null || child.stdout === null) throw new Error('stdio')
    try {
      let asked = 0
      const drv = await AcpSessionDriver.connect({
        cwd: process.cwd(),
        permission: 'ask',
        stdin: child.stdin,
        stdout: child.stdout,
        askPermission: async () => {
          asked += 1
          return { outcome: 'selected', optionId: 'allow' }
        },
      })
      await drv.sessionNew()
      const result = await drv.prompt('go')
      assert.equal(asked, 1)
      assert.equal(result.ok, true)
      assert.equal(result.output, 'asked')
    } finally {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => child.once('exit', () => resolve()))
    }
  })

  it('lists models from session/new configOptions', async () => {
    await withDriver({ MOCK_MODELS: '1' }, async (drv) => {
      const listed = await drv.sessionNew()
      assert.equal(listed.ok, true)
      assert.equal(listed.modelConfigId, 'model')
      assert.deepEqual(listed.models.map(row => row.modelId), ['flash', 'pro'])
      await drv.setConfigOption('model', 'pro')
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
