import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleWorkersHttp } from '../src/http.ts'
import type { Config } from '../src/config.ts'

const plugin: Config = {
  providerName: 'pihuo-acp',
  command: 'node',
  args: ['mock.js'],
  env: {},
  disposeGraceMs: 3000,
}

function mockReq(method: string, body?: string, url = '/pihuo/workers'): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage & EventEmitter
  req.method = method
  req.url = url
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

function mockRes(): ServerResponse & { status: number; body: string } {
  const res = {
    status: 0,
    body: '',
    writeHead(status: number) {
      this.status = status
      return this
    },
    end(chunk?: string) {
      this.body = chunk ?? ''
    },
  }
  return res as unknown as ServerResponse & { status: number; body: string }
}

describe('handleWorkersHttp', () => {
  it('GET returns plugin defaults when the file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-http-'))
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = dir
    try {
      const res = mockRes()
      await handleWorkersHttp(mockReq('GET'), res, plugin, () => ({ poolSize: 0 }))
      assert.equal(res.status, 200)
      const body = JSON.parse(res.body) as {
        workers: Array<{ command: string; id: string }>
        status: { poolSize: number }
      }
      assert.equal(body.workers[0]?.command, 'node')
      assert.equal(body.workers[0]?.id, 'default')
      assert.equal(body.status.poolSize, 0)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('PUT rejects a bare node command and accepts a roster', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-http-'))
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = dir
    try {
      const bad = mockRes()
      await handleWorkersHttp(
        mockReq('PUT', JSON.stringify({
          workers: [{ id: 'default', command: 'node', args: [] }],
        })),
        bad,
        plugin,
        () => ({ poolSize: 0 }),
      )
      assert.equal(bad.status, 400)

      const ok = mockRes()
      await handleWorkersHttp(
        mockReq('PUT', JSON.stringify({
          workers: [{
            id: 'default',
            title: 'Default',
            trusted: true,
            command: 'node',
            args: ['agent.js'],
          }],
        })),
        ok,
        plugin,
        () => ({ poolSize: 1 }),
      )
      assert.equal(ok.status, 200)
      const body = JSON.parse(ok.body) as { revision: number; workers: Array<{ command: string }> }
      assert.equal(body.revision, 1)
      assert.equal(body.workers[0]?.command, 'node')

      const catalog = mockRes()
      await handleWorkersHttp(
        mockReq('GET', undefined, '/pihuo/catalog'),
        catalog,
        plugin,
        () => ({ poolSize: 0 }),
        async () => ({
          catalog: [{
            id: 'claude-acp',
            title: 'Claude Agent',
            summary: 'ACP wrapper',
            command: 'claude-agent-acp',
            args: ['-y', '@agentclientprotocol/claude-agent-acp@0.68.0'],
            source: 'registry',
            distribution: 'npx',
            version: '0.68.0',
          }],
          source: 'live',
          version: '1.0.0',
        }),
      )
      assert.equal(catalog.status, 200)
      const listed = JSON.parse(catalog.body) as {
        catalog: Array<{ id: string; command: string }>
        source: string
        version: string
      }
      assert.equal(listed.source, 'live')
      assert.equal(listed.version, '1.0.0')
      assert.ok(listed.catalog.some(item => item.id === 'claude-acp' && item.command === 'claude-agent-acp'))

      let bust: boolean | undefined
      const refreshed = mockRes()
      await handleWorkersHttp(
        mockReq('POST', undefined, '/pihuo/catalog/refresh'),
        refreshed,
        plugin,
        () => ({ poolSize: 0 }),
        async (opts) => {
          bust = opts?.bust
          return { catalog: [], source: 'live', version: '1.0.0' }
        },
      )
      assert.equal(refreshed.status, 200)
      assert.equal(bust, true)

      const models = mockRes()
      await handleWorkersHttp(
        mockReq('POST', JSON.stringify({ command: 'opencode', args: ['acp'] }), '/pihuo/workers/models'),
        models,
        plugin,
        () => ({ poolSize: 0 }),
        undefined,
        async (input) => {
          assert.equal(input.command, 'opencode')
          return {
            ok: true,
            models: [{ modelId: 'opencode/big-pickle', name: 'Big Pickle' }],
            currentModelId: 'opencode/big-pickle',
          }
        },
      )
      assert.equal(models.status, 200)
      const listedModels = JSON.parse(models.body) as {
        ok: boolean
        models: Array<{ modelId: string }>
      }
      assert.equal(listedModels.ok, true)
      assert.equal(listedModels.models[0]?.modelId, 'opencode/big-pickle')

      const probed = mockRes()
      await handleWorkersHttp(
        mockReq('POST', JSON.stringify({ command: 'opencode', args: ['acp'] }), '/pihuo/workers/probe-acp'),
        probed,
        plugin,
        () => ({ poolSize: 0 }),
        undefined,
        undefined,
        async (input) => {
          assert.equal(input.command, 'opencode')
          return {
            ok: true,
            status: 'ready',
            code: 'SESSION_READY',
            message: 'Initialize and session/new succeeded',
            models: [{ modelId: 'opencode/big-pickle', name: 'Big Pickle' }],
          }
        },
      )
      assert.equal(probed.status, 200)
      const probeBody = JSON.parse(probed.body) as { ok: boolean; status: string; code: string }
      assert.equal(probeBody.ok, true)
      assert.equal(probeBody.status, 'ready')
      assert.equal(probeBody.code, 'SESSION_READY')

      const locateNpx = mockRes()
      await handleWorkersHttp(
        mockReq('POST', JSON.stringify({
          command: 'node',
          workerId: 'grok-build',
          distribution: 'npx',
        }), '/pihuo/workers/probe'),
        locateNpx,
        plugin,
        () => ({ poolSize: 0 }),
      )
      assert.equal(locateNpx.status, 200)
      assert.equal((JSON.parse(locateNpx.body) as { found: boolean }).found, false)
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
