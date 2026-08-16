/**
 * Same-origin PiHuo worker HTTP.
 * GET/PUT /pihuo/workers — roster, no secrets.
 * GET /pihuo/catalog — official ACP Registry projection (no install).
 * POST /pihuo/catalog/refresh — same, with a cache-bust query.
 * POST /pihuo/workers/probe — catalog locate, no spawn. npx/uvx = prefix dir only.
 * POST /pihuo/workers/probe-acp — spawn, initialize, session/new, kill.
 * POST /pihuo/workers/models — same handshake; returns the model slice.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config as PluginConfig } from './config.js'
import { loadOfficialCatalog, type LoadedCatalog } from './registry-load.js'
import { readRoster, writeRoster } from './store.js'
import type { ListModelsInput, ListModelsResult } from './list-models.js'
import type { AcpProbeResult, ProbeAcpInput } from './probe-acp.js'
import { getInstallJob, locateWorkerCommand, startInstallJob, validatePackageSpec } from './install.js'
import { listLive, type LiveRun } from './live.js'
import { readTeam, writeTeam } from './team-store.js'

export interface WorkersHttpStatus {
  readonly poolSize: number
}

function pathnameOf(req: IncomingMessage): string {
  const raw = req.url ?? '/'
  const q = raw.indexOf('?')
  return q === -1 ? raw : raw.slice(0, q)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(json)
}

/**
 * Dispatch one `/pihuo…` request.
 * GET `/pihuo/workers` returns `{ revision, workers, status }`.
 * PUT `/pihuo/workers` expects `{ workers: [...] }` or a raw array.
 * GET `/pihuo/catalog` returns `{ catalog, source, version }` from the official
 * index (live → LKG → bundled). POST `/pihuo/catalog/refresh` busts the CDN
 * cache then uses the same fallbacks. `loadCatalog` and `listModels` are
 * injectable for tests.
 */
export async function handlePihuoHttp(
  req: IncomingMessage,
  res: ServerResponse,
  plugin: PluginConfig,
  status: () => WorkersHttpStatus,
  loadCatalog: (opts?: { bust?: boolean }) => Promise<LoadedCatalog> = opts => loadOfficialCatalog(process.env, fetch, opts),
  listModels?: (input: ListModelsInput) => Promise<ListModelsResult>,
  probeAcp?: (input: ProbeAcpInput) => Promise<AcpProbeResult>,
): Promise<void> {
  const method = req.method ?? 'GET'
  const path = pathnameOf(req)
  if (path === '/pihuo/catalog' && method === 'GET') {
    send(res, 200, await loadCatalog())
    return
  }
  if (path === '/pihuo/catalog/refresh' && method === 'POST') {
    send(res, 200, await loadCatalog({ bust: true }))
    return
  }
  if (path === '/pihuo/workers/probe' && method === 'POST') {
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { issues: ['body must be JSON'] })
      return
    }
    const rec = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    const command = typeof rec.command === 'string' ? rec.command : ''
    const workerId = typeof rec.workerId === 'string' ? rec.workerId : undefined
    const distribution = rec.distribution === 'npx' || rec.distribution === 'uvx' || rec.distribution === 'binary'
      ? rec.distribution
      : undefined
    send(res, 200, locateWorkerCommand(
      command,
      workerId,
      distribution === undefined ? undefined : { distribution },
    ))
    return
  }
  if (path === '/pihuo/workers/models' && method === 'POST') {
    if (listModels === undefined) {
      send(res, 501, { ok: false, models: [], error: 'model list is not wired' })
      return
    }
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { ok: false, models: [], issues: ['body must be JSON'] })
      return
    }
    const rec = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    const command = typeof rec.command === 'string' ? rec.command : ''
    const args = Array.isArray(rec.args)
      ? rec.args.filter((item): item is string => typeof item === 'string')
      : []
    const model = typeof rec.model === 'string' ? rec.model : undefined
    send(res, 200, await listModels({
      command,
      args,
      ...model === undefined || model === '' ? {} : { model },
    }))
    return
  }
  if (path === '/pihuo/workers/probe-acp' && method === 'POST') {
    if (probeAcp === undefined) {
      send(res, 501, { ok: false, status: 'failed', code: 'NOT_WIRED', message: 'ACP probe is not wired', models: [] })
      return
    }
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { ok: false, status: 'failed', code: 'BAD_BODY', message: 'body must be JSON', models: [] })
      return
    }
    const rec = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    const command = typeof rec.command === 'string' ? rec.command : ''
    const args = Array.isArray(rec.args)
      ? rec.args.filter((item): item is string => typeof item === 'string')
      : []
    const model = typeof rec.model === 'string' ? rec.model : undefined
    send(res, 200, await probeAcp({
      command,
      args,
      ...model === undefined || model === '' ? {} : { model },
    }))
    return
  }
  if (path === '/pihuo/workers/install' && method === 'POST') {
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { issues: ['body must be JSON'] })
      return
    }
    const rec = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    const packageSpec = typeof rec.packageSpec === 'string' ? rec.packageSpec.trim() : ''
    const distribution = rec.distribution === 'uvx' ? 'uvx' : rec.distribution === 'npx' ? 'npx' : undefined
    const commandName = typeof rec.commandName === 'string' ? rec.commandName.trim() : ''
    const workerId = typeof rec.workerId === 'string' ? rec.workerId.trim() : 'worker'
    if (distribution === undefined || !validatePackageSpec(packageSpec) || commandName === '') {
      send(res, 400, { issues: ['need packageSpec, commandName, and npx/uvx'] })
      return
    }
    send(res, 200, startInstallJob({ workerId, packageSpec, distribution, commandName }))
    return
  }
  if (path === '/pihuo/workers/install' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const id = url.searchParams.get('id') ?? ''
    const job = getInstallJob(id)
    if (job === undefined) {
      send(res, 404, { issues: ['no such install'] })
      return
    }
    send(res, 200, job)
    return
  }
  if (path === '/pihuo/workers/live' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const parent = url.searchParams.get('parent') ?? ''
    const runs: LiveRun[] = parent === '' ? [] : listLive(parent)
    send(res, 200, { runs })
    return
  }
  if (path === '/pihuo/team' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const sessionId = url.searchParams.get('session') ?? ''
    if (sessionId === '') {
      send(res, 400, { issues: ['session is required'] })
      return
    }
    send(res, 200, readTeam(sessionId))
    return
  }
  if (path === '/pihuo/team' && method === 'PUT') {
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { issues: ['body must be JSON'] })
      return
    }
    const rec = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {}
    const sessionId = typeof rec.sessionId === 'string' ? rec.sessionId : ''
    if (sessionId === '') {
      send(res, 400, { issues: ['sessionId is required'] })
      return
    }
    const saved = writeTeam(sessionId, rec)
    if (saved.lastError !== undefined) {
      send(res, 400, { issues: [saved.lastError] })
      return
    }
    send(res, 200, saved)
    return
  }
  if (path !== '/pihuo/workers') {
    res.writeHead(404)
    res.end()
    return
  }
  if (method === 'GET') {
    const effective = readRoster(plugin)
    send(res, 200, { ...effective, status: status() })
    return
  }
  if (method === 'PUT') {
    let raw: unknown
    try {
      raw = JSON.parse(await readBody(req)) as unknown
    } catch {
      send(res, 400, { issues: ['body must be JSON'] })
      return
    }
    const list = Array.isArray(raw)
      ? raw
      : (typeof raw === 'object' && raw !== null && 'workers' in raw
        ? (raw as { workers: unknown }).workers
        : undefined)
    if (list === undefined) {
      send(res, 400, { issues: ['body must be { workers: [...] }'] })
      return
    }
    const saved = writeRoster(plugin, list)
    if (saved.lastError !== undefined) {
      send(res, 400, { issues: [saved.lastError] })
      return
    }
    send(res, 200, { ...saved, status: status() })
    return
  }
  res.writeHead(405)
  res.end()
}

/** @deprecated Use {@link handlePihuoHttp}. */
export const handleWorkersHttp = handlePihuoHttp
