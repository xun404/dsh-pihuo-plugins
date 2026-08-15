import type { WorkerStopReason } from '@pihuo/dsh-worker-protocol'

/**
 * Map an ACP `session/prompt` stopReason onto the harness worker vocabulary.
 * `max_turn_requests` and any unknown string become `error` so a partial
 * answer is never reported as `completed`.
 */
export function acpStopReason(reason: string): WorkerStopReason {
  switch (reason) {
    case 'end_turn':
      return 'completed'
    case 'max_tokens':
      return 'max-tokens'
    case 'refusal':
      return 'refusal'
    case 'cancelled':
      return 'aborted'
    default:
      return 'error'
  }
}
