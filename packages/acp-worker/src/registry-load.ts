/**
 * Load the official ACP Registry index for the settings catalog.
 * Live CDN first, then `$DSH_HOME/pihuo/registry-lkg.json`, then bundled
 * templates. Never downloads agent archives and never runs `npx`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ACP_REGISTRY_URL,
  parseAcpRegistry,
  WORKER_CATALOG,
  type WorkerCatalogEntry,
} from '@pihuo/dsh-worker-protocol'
import { resolvePihuoHome } from './store.js'

export type CatalogSource = 'live' | 'lkg' | 'bundled'

export interface LoadedCatalog {
  readonly catalog: readonly WorkerCatalogEntry[]
  readonly source: CatalogSource
  readonly version?: string
}

const FETCH_MS = 8_000

export function registryLkgPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolvePihuoHome(env), 'registry-lkg.json')
}

function officialRows(rows: readonly WorkerCatalogEntry[]): WorkerCatalogEntry[] {
  return rows.filter(row => row.id !== 'custom')
}

function readLkg(env: NodeJS.ProcessEnv): { version: string; catalog: WorkerCatalogEntry[] } | undefined {
  try {
    const parsed = parseAcpRegistry(JSON.parse(readFileSync(registryLkgPath(env), 'utf8')) as unknown)
    if ('issues' in parsed || parsed.catalog.length === 0) return undefined
    return parsed
  } catch {
    return undefined
  }
}

function writeLkg(text: string, env: NodeJS.ProcessEnv): void {
  const path = registryLkgPath(env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

/**
 * Resolve the catalog shown on GET `/pihuo/catalog`.
 * `fetchImpl` is injectable so unit tests do not hit the CDN.
 */
export async function loadOfficialCatalog(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
  opts: { bust?: boolean } = {},
): Promise<LoadedCatalog> {
  const url = opts.bust === true ? `${ACP_REGISTRY_URL}?t=${String(Date.now())}` : ACP_REGISTRY_URL
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => { ac.abort() }, FETCH_MS)
    const res = await fetchImpl(url, { signal: ac.signal })
    clearTimeout(timer)
    if (res.ok) {
      const text = await res.text()
      const parsed = parseAcpRegistry(JSON.parse(text) as unknown)
      if ('catalog' in parsed && parsed.catalog.length > 0) {
        writeLkg(`${text.endsWith('\n') ? text : `${text}\n`}`, env)
        return { catalog: officialRows(parsed.catalog), source: 'live', version: parsed.version }
      }
    }
  } catch {
    // Fall through to LKG / bundled.
  }
  const lkg = readLkg(env)
  if (lkg !== undefined) {
    return { catalog: officialRows(lkg.catalog), source: 'lkg', version: lkg.version }
  }
  return { catalog: officialRows(WORKER_CATALOG), source: 'bundled' }
}
