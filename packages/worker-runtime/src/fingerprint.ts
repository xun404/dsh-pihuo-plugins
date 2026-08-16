/**
 * Process-agnostic helpers for worker session identity.
 */
import { createHash } from 'node:crypto'
import type { WorkerReuseKey } from '@pihuo/dsh-worker-protocol'

export type { WorkerReuseKey } from '@pihuo/dsh-worker-protocol'

/** Inputs that distinguish one spawn configuration. Do not pass secret values. */
export interface FingerprintInput {
  readonly command: string
  readonly args: readonly string[]
  readonly model?: string
  readonly reasoning?: string
  /** Environment *names* that affect execution, sorted at digest time. */
  readonly envNames: readonly string[]
}

/**
 * SHA-256 hex digest of the canonical spawn identity.
 * `envNames` is sorted so caller order cannot fork the pool key.
 */
export function fingerprintOf(input: FingerprintInput): string {
  const payload = JSON.stringify({
    command: input.command,
    args: input.args,
    model: input.model ?? '',
    reasoning: input.reasoning ?? '',
    envNames: [...input.envNames].sort(),
  })
  return createHash('sha256').update(payload).digest('hex')
}

/** Stable map key for one {@link WorkerReuseKey}. Null bytes separate fields. */
export function reuseKeyId(key: WorkerReuseKey): string {
  return [key.parentSessionId, key.workerId, key.revision, key.cwd, key.fingerprint].join('\0')
}
