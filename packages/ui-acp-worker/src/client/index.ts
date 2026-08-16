/**
 * Browser half of `@pihuo/dsh-pihuo-acp-ui`.
 *
 * Registers a keyed `tool.call.toolview` for wire name `acp_worker`. Must ship
 * as the CJS factory at `exports["./client"]` (`lib/client.js`); tsc's
 * `lib/client/index.js` is types-only and is not what the host serves.
 */
import { en, NS, zh, type Translate } from './locales.js'
import { WorkersHeaderAction } from './header-action.js'
import { AcpWorkerRow } from './tool-row.js'

/** Cordis services this apply reads. `locale` is the first-party zh/en runtime. */
export const inject = ['slots', 'locale']
import { WorkersSection, type WorkersSectionInjected } from './settings.js'

/** Minimal slots face this plugin touches. Components never see `ctx`. */
interface ClientCtx {
  slots: {
    inject(name: string, factory: () => unknown): unknown
    register(spec: {
      name: string
      key?: string
      id?: string
      order?: number
      label?: string | (() => string)
      locale?: string
      inject?: () => unknown
    }, component: unknown): unknown
  }
  locale: {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void
    bind(ns: string): Translate
  }
  effect(factory: () => unknown, label?: string): unknown
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error(text || `HTTP ${String(res.status)}`)
  }
}

function workersApi(): WorkersSectionInjected {
  return {
    async load() {
      const res = await fetch('/pihuo/workers')
      const body = await readJson(res)
      if (!res.ok) throw new Error(JSON.stringify(body))
      return body as Awaited<ReturnType<WorkersSectionInjected['load']>>
    },
    async save(workers) {
      const res = await fetch('/pihuo/workers', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workers }),
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(typeof body === 'object' && body !== null && 'issues' in body
        ? (body as { issues: string[] }).issues.join('; ')
        : JSON.stringify(body))
      return body as Awaited<ReturnType<WorkersSectionInjected['load']>>
    },
    async catalog(opts) {
      const res = await fetch(opts?.refresh === true ? '/pihuo/catalog/refresh' : '/pihuo/catalog', {
        method: opts?.refresh === true ? 'POST' : 'GET',
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(JSON.stringify(body))
      const rec = body as { catalog?: unknown; source?: unknown; version?: unknown }
      const source = rec.source === 'live' || rec.source === 'lkg' || rec.source === 'bundled'
        ? rec.source
        : undefined
      return {
        catalog: Array.isArray(rec.catalog)
          ? rec.catalog as Awaited<ReturnType<WorkersSectionInjected['catalog']>>['catalog']
          : [],
        ...source === undefined ? {} : { source },
        ...typeof rec.version === 'string' ? { version: rec.version } : {},
      }
    },
    async probe(input) {
      const res = await fetch('/pihuo/workers/probe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          command: input.command,
          ...input.workerId === undefined ? {} : { workerId: input.workerId },
          ...input.distribution === undefined ? {} : { distribution: input.distribution },
        }),
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(JSON.stringify(body))
      return body as Awaited<ReturnType<WorkersSectionInjected['probe']>>
    },
    async probeAcp(input) {
      const res = await fetch('/pihuo/workers/probe-acp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: input.command, args: input.args }),
      })
      const body = await readJson(res)
      const rec = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
      const models = Array.isArray(rec.models)
        ? rec.models.filter((row): row is { modelId: string; name: string } => (
          typeof row === 'object' && row !== null
          && typeof (row as { modelId?: unknown }).modelId === 'string'
          && typeof (row as { name?: unknown }).name === 'string'
        ))
        : []
      const status = rec.status === 'ready' || rec.status === 'auth_required' || rec.status === 'incompatible' || rec.status === 'failed'
        ? rec.status
        : 'failed'
      return {
        ok: rec.ok === true,
        status,
        code: typeof rec.code === 'string' ? rec.code : 'FAILED',
        message: typeof rec.message === 'string' ? rec.message : (res.ok ? '' : JSON.stringify(body)),
        models,
        ...typeof rec.currentModelId === 'string' ? { currentModelId: rec.currentModelId } : {},
        ...typeof rec.agentName === 'string' ? { agentName: rec.agentName } : {},
        ...typeof rec.agentVersion === 'string' ? { agentVersion: rec.agentVersion } : {},
        ...typeof rec.protocolVersion === 'number' ? { protocolVersion: rec.protocolVersion } : {},
      }
    },
    async models(input) {
      const res = await fetch('/pihuo/workers/models', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: input.command, args: input.args }),
      })
      const body = await readJson(res)
      const rec = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
      const models = Array.isArray(rec.models)
        ? rec.models.filter((row): row is { modelId: string; name: string } => (
          typeof row === 'object' && row !== null
          && typeof (row as { modelId?: unknown }).modelId === 'string'
          && typeof (row as { name?: unknown }).name === 'string'
        ))
        : []
      return {
        ok: rec.ok === true,
        models,
        ...typeof rec.currentModelId === 'string' ? { currentModelId: rec.currentModelId } : {},
        ...typeof rec.error === 'string' ? { error: rec.error } : {},
      }
    },
    async startInstall(input) {
      const res = await fetch('/pihuo/workers/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = await readJson(res)
      if (!res.ok) throw new Error(JSON.stringify(body))
      return body as Awaited<ReturnType<WorkersSectionInjected['startInstall']>>
    },
    async installStatus(id) {
      const res = await fetch(`/pihuo/workers/install?id=${encodeURIComponent(id)}`)
      const body = await readJson(res)
      if (!res.ok) throw new Error(JSON.stringify(body))
      return body as Awaited<ReturnType<WorkersSectionInjected['installStatus']>>
    },
  }
}

/** Stable inject face so the section does not remount on every slot render. */
const workersInjected = workersApi()

/**
 * Register the `acp_worker` tool row.
 * The Host loader row for this package must stay live or `client-modules`
 * drops `./client` from `__DSH_BOOT__.entries` and the generic card is used.
 */
export function apply(ctx: ClientCtx): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-acp-worker: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(
    () => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: 'acp_worker', locale: NS },
      AcpWorkerRow,
    )),
    'ui-acp-worker: toolview',
  )
  ctx.effect(
    () => ctx.slots.inject('settings.section', () => ctx.slots.register(
      {
        name: 'settings.section',
        id: 'pihuo-workers',
        order: 25,
        locale: NS,
        label: () => t('nav'),
        inject: () => workersInjected,
      },
      WorkersSection,
    )),
    'ui-acp-worker: settings',
  )
  ctx.effect(
    () => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
      {
        name: 'conversation.session.header.actions',
        id: 'acp-workers',
        order: 30,
        locale: NS,
        inject: () => workersInjected,
      },
      WorkersHeaderAction,
    )),
    'ui-acp-worker: header',
  )
}
