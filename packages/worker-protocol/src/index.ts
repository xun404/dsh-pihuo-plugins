/**
 * Shared worker vocabulary used by every backend (ACP today, others later).
 * This package must stay free of Cordis and of any ACP SDK so Host and Client
 * can both import the types without pulling a runtime.
 */

/** How a worker answers ACP `session/request_permission` (or a future equivalent). */
export type WorkerPermissionPolicy = 'ask' | 'allow' | 'reject'

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
}

/**
 * One UI-only activity sample. Must not be `session.append`'d as a new event
 * type (unknown types without `ignorable` refuse the whole log on load).
 */
export interface WorkerActivity {
  readonly kind: 'message' | 'thought' | 'tool' | 'plan'
  readonly text: string
}

/**
 * Replayable card payload for `tool/result` `presentationMeta` on `acp_worker`.
 * The model-facing canonical value stays a short string; details live here.
 */
export interface AcpWorkerPresentationMeta {
  readonly workerId: string
  readonly output: string
  readonly stopReason: WorkerStopReason
  readonly activities?: readonly WorkerActivity[]
}
