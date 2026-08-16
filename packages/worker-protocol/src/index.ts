/**
 * Shared worker vocabulary used by every backend (ACP today, others later).
 * This package must stay free of Cordis and of any ACP SDK so Host and Client
 * can both import the types without pulling a runtime.
 */

export {
  DEFAULT_IDLE_TTL_MS,
  DEFAULT_POOL_MAX,
  MAX_POOL_MAX,
  WORKER_ID_DEFAULT,
  WORKER_ID_PATTERN,
  WORKER_USER_CONFIG_DEFAULTS,
  decodeWorkerUserFile,
  encodeWorkerUserFile,
  mergeWorkerConfig,
  parseWorkerRoster,
  parseWorkerRosterEntry,
  parseWorkerUserConfig,
  upgradeV1Config,
} from './config.js'
export type { WorkerCheck, WorkerCheckKind, WorkerRosterEntry, WorkerUserConfig, WorkerUserFile } from './config.js'
export { WORKER_CATALOG } from './catalog.js'
export type { CatalogEntrySource, WorkerCatalogEntry } from './catalog.js'
export { ACP_REGISTRY_URL, parseAcpRegistry, projectRegistryAgent } from './registry.js'
export type { AcpRegistryTarget, CatalogDistribution } from './registry.js'
export { binaryNameFromPackageSpec, packageSpecFromArgs } from './package-spec.js'
export { inferTeamRole, parseDispatchHint, parseWorkerIdHint, resolveDispatch, resolveRosterWorker, stripWorkerIdLine } from './select.js'
export type { DispatchHint, DispatchResolution } from './select.js'
export {
  TEAM_ROLE_PATTERN,
  TEAM_ROLES,
  decodeChatTeam,
  encodeChatTeam,
  parseChatTeam,
  parseTeamMember,
} from './team.js'
export type { ChatTeam, TeamMember, TeamRole } from './team.js'
export { chatPresetToWorkerPolicy, parentChatPreset } from './inherit.js'
export type { ChatPermissionPreset, WorkerPermissionPolicy } from './inherit.js'

/**
 * Terminal outcome of one worker prompt, aligned with
 * `@deepseek-ai/dsh-subagent`'s `SubagentStopReason`.
 * Unknown ACP stop reasons must become `error`, never `completed`.
 */
export type WorkerStopReason =
  | 'completed'
  | 'aborted'
  | 'error'
  | 'max-tokens'
  | 'refusal'

/**
 * Identity of one reusable worker session.
 * `fingerprint` is a digest of spawn identity (command/args/model/env *names*).
 * Secret values must never appear in any field.
 */
export interface WorkerReuseKey {
  readonly parentSessionId: string
  readonly workerId: string
  readonly revision: string
  readonly cwd: string
  readonly fingerprint: string
}

/** Result of one `session/prompt` as the Leader-facing tool should see it. */
export interface WorkerPromptResult {
  readonly ok: boolean
  readonly output: string
  readonly stopReason: WorkerStopReason
  /** Present only when `ok` is false; human-readable, not an internal code. */
  readonly error?: string
  /** Live Think/Tool samples. Never a new session event type. */
  readonly activities?: readonly WorkerActivity[]
}

/**
 * One UI-only activity sample. Must not be `session.append`'d as a new event
 * type (unknown types without `ignorable` refuse the whole log on load).
 */
export interface WorkerActivity {
  readonly kind: 'message' | 'thought' | 'tool' | 'plan'
  readonly text: string
  readonly toolCallId?: string
  readonly toolTitle?: string
  readonly toolStatus?: string
}

/**
 * Replayable card payload for `tool/result` `presentationMeta` on `acp_worker`.
 * The model-facing canonical value stays a short string; details live here.
 */
export interface AcpWorkerPresentationMeta {
  readonly workerId: string
  readonly title?: string
  readonly model?: string
  readonly thinking?: string
  readonly output: string
  readonly stopReason: WorkerStopReason
  readonly activities?: readonly WorkerActivity[]
}
