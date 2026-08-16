/**
 * User-editable worker settings persisted under `$DSH_HOME/pihuo/workers.json`.
 * Secrets never appear in this document. Version 1 was a single flat object;
 * readers upgrade it to one roster row `id: "default"`.
 */

/** Fallback roster id and the v1 upgrade target. */
export const WORKER_ID_DEFAULT = 'default'

/** Roster `id` and `workerId:` hint. */
export const WORKER_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/

/** Idle eviction bound in milliseconds when the user omits `idleTtlMs`. */
export const DEFAULT_IDLE_TTL_MS = 300_000

/** Concurrent children when the user omits `poolMax`. */
export const DEFAULT_POOL_MAX = 4

/** Hard cap for `poolMax`; larger values clamp down. */
export const MAX_POOL_MAX = 16

/**
 * Fields the settings page, HTTP DTO, and spawn path share.
 * Secret values (API keys, tokens) must never appear here.
 */
export interface WorkerUserConfig {
  /**
   * When false, `start()` fails without spawning.
   * Default `true`. Disabled documents may keep an inert `node` + empty `args`.
   */
  readonly enabled: boolean
  /**
   * Executable, absolute or on PATH.
   * Required when `enabled` is true; `node` then also needs a script in `args`.
   */
  readonly command: string
  /**
   * Argv tokens after `command`. One token per settings-page line.
   * Empty is legal except for enabled `command === "node"` (that would open a REPL).
   */
  readonly args: readonly string[]
  /**
   * Default model advertised by the worker. Applied with
   * `session/set_config_option` after `session/new`. OpenCode also gets
   * `OPENCODE_MODEL`. Digested into the reuse fingerprint; not a secret.
   */
  readonly model?: string
  /** Idle eviction bound in milliseconds. Default {@link DEFAULT_IDLE_TTL_MS}. */
  readonly idleTtlMs: number
  /**
   * Maximum live children in this process.
   * Default {@link DEFAULT_POOL_MAX}; clamped to 1..{@link MAX_POOL_MAX}.
   */
  readonly poolMax: number
}

export const WORKER_USER_CONFIG_DEFAULTS: WorkerUserConfig = {
  enabled: true,
  command: 'node',
  args: [],
  idleTtlMs: DEFAULT_IDLE_TTL_MS,
  poolMax: DEFAULT_POOL_MAX,
}

/**
 * One named row in the settings roster.
 * `trusted` is the user's explicit permission to spawn this CLI. Enabled but
 * untrusted rows stay on disk and never start a process.
 */
export interface WorkerRosterEntry extends WorkerUserConfig {
  /** Stable id (`^[a-z][a-z0-9_-]{0,63}$`). Used as the pool `workerId`. */
  readonly id: string
  /** Settings-page display name. Defaults to `id` when omitted. */
  readonly title: string
  /**
   * User acknowledged that this argv runs outside the dsh sandbox.
   * `start()` refuses the row when false.
   */
  readonly trusted: boolean
  /** Catalog template this row was created from, when any. */
  readonly catalogId?: string
  /** npm/uv package this row can install, when the catalog provided one. */
  readonly packageSpec?: string
  /** How `packageSpec` is installed. */
  readonly distribution?: 'npx' | 'uvx' | 'binary'
  /**
   * Last start-check. `missing` = the command is not on this machine.
   * `failed` = it ran but did not complete an ACP handshake.
   */
  readonly check?: WorkerCheck
}

export type WorkerCheckKind = 'ready' | 'missing' | 'failed'

export interface WorkerCheck {
  readonly kind: WorkerCheckKind
  /** Command or package the user needs, when `kind` is `missing`. */
  readonly name?: string
}

/**
 * On-disk document. Always written as version 2.
 * Version 1 `{ version, revision, config }` still reads as one `default` row.
 */
export interface WorkerUserFile {
  readonly version: 2
  readonly revision: number
  readonly workers: readonly WorkerRosterEntry[]
}

function asInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isInteger(Number(value))) {
    return Number(value)
  }
  return fallback
}

/**
 * Validate and fill defaults for one user config object.
 * When `enabled` is true, `command` must be non-empty and `node` must have a
 * script in `args` (a REPL would hang on the protocol stdin). Disabled
 * documents may keep those inert values so the settings page can persist
 * "off". `poolMax` is clamped to 1..{@link MAX_POOL_MAX}.
 */
export function parseWorkerUserConfig(raw: unknown): { value: WorkerUserConfig } | { issues: string[] } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const issues: string[] = []
  const enabled = obj.enabled === false ? false : true
  const command = typeof obj.command === 'string' ? obj.command.trim() : ''
  if (enabled && command === '') issues.push('command is required')
  const args = Array.isArray(obj.args)
    ? obj.args.filter((item): item is string => typeof item === 'string')
    : [...WORKER_USER_CONFIG_DEFAULTS.args]
  if (enabled && command === 'node' && args.length === 0) {
    issues.push('command "node" requires at least one argument (the ACP agent script)')
  }
  const idleTtlMs = asInt(obj.idleTtlMs, DEFAULT_IDLE_TTL_MS)
  if (idleTtlMs < 1) issues.push('idleTtlMs must be a positive integer')
  const poolMaxRaw = asInt(obj.poolMax, DEFAULT_POOL_MAX)
  if (poolMaxRaw < 1) issues.push('poolMax must be a positive integer')
  if (issues.length > 0) return { issues }
  const model = typeof obj.model === 'string' && obj.model.trim() !== '' ? obj.model.trim() : undefined
  const value: WorkerUserConfig = {
    enabled,
    command,
    args,
    idleTtlMs,
    poolMax: Math.min(MAX_POOL_MAX, poolMaxRaw),
    ...model === undefined ? {} : { model },
  }
  return { value }
}

/** Overlay wins on provided keys; result is re-validated. */
export function mergeWorkerConfig(
  base: Partial<WorkerUserConfig>,
  overlay: Partial<WorkerUserConfig>,
): { value: WorkerUserConfig } | { issues: string[] } {
  return parseWorkerUserConfig({
    ...WORKER_USER_CONFIG_DEFAULTS,
    ...base,
    ...overlay,
  })
}

/**
 * Validate one roster row. `id` must match {@link WORKER_ID_PATTERN}.
 * `title` defaults to `id`. `trusted` defaults to false.
 */
export function parseWorkerRosterEntry(raw: unknown): { value: WorkerRosterEntry } | { issues: string[] } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const id = typeof obj.id === 'string' ? obj.id.trim() : ''
  const issues: string[] = []
  if (!WORKER_ID_PATTERN.test(id)) issues.push('id must match [a-z][a-z0-9_-]{0,63}')
  const parsed = parseWorkerUserConfig(obj)
  if ('issues' in parsed) issues.push(...parsed.issues)
  if (issues.length > 0) return { issues }
  if (!('value' in parsed)) return { issues }
  const title = typeof obj.title === 'string' && obj.title.trim() !== '' ? obj.title.trim() : id
  const catalogId = typeof obj.catalogId === 'string' && obj.catalogId.trim() !== ''
    ? obj.catalogId.trim()
    : undefined
  const packageSpec = typeof obj.packageSpec === 'string' && obj.packageSpec.trim() !== ''
    ? obj.packageSpec.trim()
    : undefined
  const distribution = obj.distribution === 'npx' || obj.distribution === 'uvx' || obj.distribution === 'binary'
    ? obj.distribution
    : undefined
  const check = parseWorkerCheck(obj.check)
  return {
    value: {
      ...parsed.value,
      id,
      title,
      trusted: obj.trusted === true,
      ...catalogId === undefined ? {} : { catalogId },
      ...packageSpec === undefined ? {} : { packageSpec },
      ...distribution === undefined ? {} : { distribution },
      ...check === undefined ? {} : { check },
    },
  }
}

function parseWorkerCheck(raw: unknown): WorkerCheck | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const rec = raw as { kind?: unknown; name?: unknown }
  if (rec.kind !== 'ready' && rec.kind !== 'missing' && rec.kind !== 'failed') return undefined
  const name = typeof rec.name === 'string' && rec.name.trim() !== '' ? rec.name.trim() : undefined
  return {
    kind: rec.kind,
    ...name === undefined ? {} : { name },
  }
}

/**
 * Validate a roster. Empty is legal (nothing to spawn). Duplicate ids fail.
 */
export function parseWorkerRoster(raw: unknown): { value: WorkerRosterEntry[] } | { issues: string[] } {
  if (!Array.isArray(raw)) return { issues: ['workers must be an array'] }
  const workers: WorkerRosterEntry[] = []
  const seen = new Set<string>()
  const issues: string[] = []
  for (const [index, item] of raw.entries()) {
    const parsed = parseWorkerRosterEntry(item)
    if ('issues' in parsed) {
      issues.push(`workers[${String(index)}]: ${parsed.issues.join('; ')}`)
      continue
    }
    if (seen.has(parsed.value.id)) {
      issues.push(`duplicate worker id "${parsed.value.id}"`)
      continue
    }
    seen.add(parsed.value.id)
    workers.push(parsed.value)
  }
  if (issues.length > 0) return { issues }
  return { value: workers }
}

/** Promote a v1 single config into one trusted `default` row. */
export function upgradeV1Config(config: WorkerUserConfig): WorkerRosterEntry {
  return {
    ...config,
    id: WORKER_ID_DEFAULT,
    title: 'Default',
    trusted: true,
  }
}

/** Serialize the on-disk document. `revision` is the pool key generation. */
export function encodeWorkerUserFile(workers: readonly WorkerRosterEntry[], revision: number): string {
  const body: WorkerUserFile = { version: 2, revision, workers }
  return `${JSON.stringify(body, null, 2)}\n`
}

/**
 * Parse the on-disk document.
 * Version 2 is `{ version, revision, workers }`. Version 1 and a bare config
 * object become one `default` row with `trusted: true`.
 */
export function decodeWorkerUserFile(text: string): { value: WorkerUserFile } | { issues: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return { issues: ['workers.json is not valid JSON'] }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { issues: ['workers.json must be an object'] }
  }
  const doc = raw as Record<string, unknown>
  const revision = asInt(doc.revision, 0)
  if (revision < 0) return { issues: ['revision must be a non-negative integer'] }
  if (doc.version === 2 || Array.isArray(doc.workers)) {
    if (doc.version !== 2 && doc.version !== undefined) {
      return { issues: [`unsupported workers.json version: ${String(doc.version)}`] }
    }
    const parsed = parseWorkerRoster(doc.workers)
    if ('issues' in parsed) return parsed
    return { value: { version: 2, revision, workers: parsed.value } }
  }
  if (doc.version !== 1 && doc.version !== undefined) {
    return { issues: [`unsupported workers.json version: ${String(doc.version)}`] }
  }
  const parsed = parseWorkerUserConfig(doc.config ?? doc)
  if ('issues' in parsed) return parsed
  return { value: { version: 2, revision, workers: [upgradeV1Config(parsed.value)] } }
}
