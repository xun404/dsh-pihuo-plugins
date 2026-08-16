/**
 * Project the official ACP Registry index
 * (`https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`,
 * published from github.com/agentclientprotocol/registry) onto catalog rows.
 * Does not download archives or run `npx`/`uvx`.
 */
import type { WorkerCatalogEntry } from './catalog.js'
import { binaryNameFromPackageSpec } from './package-spec.js'

/** CDN index the Host fetches. The GitHub repo is the source, not the client API. */
export const ACP_REGISTRY_URL = 'https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json'

const TARGETS = [
  'darwin-aarch64',
  'darwin-x86_64',
  'linux-aarch64',
  'linux-x86_64',
  'windows-aarch64',
  'windows-x86_64',
] as const

export type AcpRegistryTarget = (typeof TARGETS)[number]

export type CatalogDistribution = 'npx' | 'uvx' | 'binary'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Array.isArray(value) === false
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function hostTarget(platform: NodeJS.Platform = process.platform, arch: string = process.arch): AcpRegistryTarget | undefined {
  if (platform === 'darwin' && arch === 'arm64') return 'darwin-aarch64'
  if (platform === 'darwin' && (arch === 'x64' || arch === 'x86_64')) return 'darwin-x86_64'
  if (platform === 'linux' && arch === 'arm64') return 'linux-aarch64'
  if (platform === 'linux' && (arch === 'x64' || arch === 'x86_64')) return 'linux-x86_64'
  if (platform === 'win32' && arch === 'arm64') return 'windows-aarch64'
  if (platform === 'win32' && (arch === 'x64' || arch === 'x86_64')) return 'windows-x86_64'
  return undefined
}

function basenameCommand(cmd: string): string {
  const trimmed = cmd.trim().replace(/\\/g, '/')
  const base = trimmed.split('/').pop() ?? trimmed
  return base.replace(/^\.\//, '')
}

const ICON_HOST = 'cdn.agentclientprotocol.com'

function officialIcon(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.hostname !== ICON_HOST) return undefined
    if (!parsed.pathname.startsWith('/registry/')) return undefined
    return parsed.href
  } catch {
    return undefined
  }
}

function httpsUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined
    return parsed.href
  } catch {
    return undefined
  }
}

function displayAuthor(value: string): string {
  return value.replace(/\s*<[^>]+>/, '').trim()
}

function projectMeta(raw: Record<string, unknown>): Partial<WorkerCatalogEntry> {
  const icon = officialIcon(asString(raw.icon))
  const authors = asStringArray(raw.authors).map(displayAuthor).filter(item => item !== '')
  const repository = httpsUrl(asString(raw.repository))
  const website = httpsUrl(asString(raw.website))
  const license = asString(raw.license)
  return {
    ...icon === undefined ? {} : { icon },
    ...authors.length === 0 ? {} : { authors },
    ...repository === undefined ? {} : { repository },
    ...website === undefined ? {} : { website },
    ...license === undefined ? {} : { license },
  }
}

function withMeta(row: WorkerCatalogEntry, raw: Record<string, unknown>): WorkerCatalogEntry {
  return { ...row, ...projectMeta(raw) }
}

function projectNpx(id: string, title: string, summary: string, version: string, npx: Record<string, unknown>): WorkerCatalogEntry | undefined {
  const pkg = asString(npx.package)
  if (pkg === undefined) return undefined
  const command = binaryNameFromPackageSpec(pkg)
  if (command === undefined) return undefined
  return {
    id,
    title,
    summary,
    command,
    args: asStringArray(npx.args),
    source: 'registry',
    distribution: 'npx',
    packageSpec: pkg,
    version,
  }
}

function projectUvx(id: string, title: string, summary: string, version: string, uvx: Record<string, unknown>): WorkerCatalogEntry | undefined {
  const pkg = asString(uvx.package)
  if (pkg === undefined) return undefined
  const command = binaryNameFromPackageSpec(pkg)
  if (command === undefined) return undefined
  return {
    id,
    title,
    summary,
    command,
    args: asStringArray(uvx.args),
    source: 'registry',
    distribution: 'uvx',
    packageSpec: pkg,
    version,
  }
}

function projectBinary(
  id: string,
  title: string,
  summary: string,
  version: string,
  binary: Record<string, unknown>,
  target: AcpRegistryTarget | undefined,
): WorkerCatalogEntry | undefined {
  const spec = target === undefined ? undefined : binary[target]
  const rec = isRecord(spec) ? spec : undefined
  if (rec === undefined) return undefined
  const cmd = asString(rec.cmd)
  if (cmd === undefined) return undefined
  return {
    id,
    title,
    summary,
    command: basenameCommand(cmd),
    args: asStringArray(rec.args),
    source: 'registry',
    distribution: 'binary',
    version,
  }
}

/**
 * Turn one official agent object into a catalog row.
 * Prefers a platform binary (PATH basename, not the archive URL), then npx, then uvx.
 */
export function projectRegistryAgent(
  raw: unknown,
  target: AcpRegistryTarget | undefined = hostTarget(),
): WorkerCatalogEntry | undefined {
  if (!isRecord(raw)) return undefined
  const id = asString(raw.id)
  const title = asString(raw.name) ?? id
  if (id === undefined || title === undefined) return undefined
  const summary = asString(raw.description) ?? title
  const version = asString(raw.version) ?? ''
  const dist = isRecord(raw.distribution) ? raw.distribution : undefined
  if (dist === undefined) return undefined
  if (isRecord(dist.binary)) {
    const row = projectBinary(id, title, summary, version, dist.binary, target)
    if (row !== undefined) return withMeta(row, raw)
  }
  if (isRecord(dist.npx)) {
    const row = projectNpx(id, title, summary, version, dist.npx)
    if (row !== undefined) return withMeta(row, raw)
  }
  if (isRecord(dist.uvx)) {
    const row = projectUvx(id, title, summary, version, dist.uvx)
    if (row !== undefined) return withMeta(row, raw)
  }
  return undefined
}

/**
 * Parse a registry.json document into catalog rows.
 * Unknown agents and unsupported platforms are skipped, not fatal.
 */
export function parseAcpRegistry(
  raw: unknown,
  target: AcpRegistryTarget | undefined = hostTarget(),
): { version: string; catalog: WorkerCatalogEntry[] } | { issues: string[] } {
  if (!isRecord(raw)) return { issues: ['registry.json must be an object'] }
  const version = asString(raw.version) ?? '0'
  if (!Array.isArray(raw.agents)) return { issues: ['registry.json.agents must be an array'] }
  const catalog: WorkerCatalogEntry[] = []
  const seen = new Set<string>()
  for (const agent of raw.agents) {
    const row = projectRegistryAgent(agent, target)
    if (row === undefined || seen.has(row.id)) continue
    seen.add(row.id)
    catalog.push(row)
  }
  return { version, catalog }
}
