import type { WorkerPermissionPolicy } from '@pihuo/dsh-worker-protocol'

export interface AcpPermissionOption {
  readonly optionId: string
  readonly kind?: string
}

/**
 * Choose an ACP permission option without a human.
 * `reject` always cancels. `allow` prefers `allow_once`, then `allow_always`.
 * Missing allow options cancel rather than inventing an id.
 */
export function pickAutoPermission(
  policy: Exclude<WorkerPermissionPolicy, 'ask'>,
  options: readonly AcpPermissionOption[],
): { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } {
  if (policy === 'reject') return { outcome: 'cancelled' }
  const allow = options.find(o => o.kind === 'allow_once') ?? options.find(o => o.kind === 'allow_always')
  if (allow === undefined) return { outcome: 'cancelled' }
  return { outcome: 'selected', optionId: allow.optionId }
}

/**
 * Map a one-shot human decision onto an ACP option.
 * `allowed-once` selects `allow_once` (then `allow_always`). Anything else cancels.
 */
export async function decideAskPermission(
  options: readonly AcpPermissionOption[],
  decide: () => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>,
): Promise<{ outcome: 'selected'; optionId: string } | { outcome: 'cancelled' }> {
  const outcome = await decide()
  if (outcome !== 'allowed-once') return { outcome: 'cancelled' }
  return pickAutoPermission('allow', options)
}
