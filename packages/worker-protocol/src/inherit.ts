/**
 * Map the chat session's workspace permission onto the ACP child's
 * `session/request_permission` policy. Workers have no permission field of
 * their own.
 */

/** Chat composer presets the host `/permission` command switches. */
export type ChatPermissionPreset = 'read-only' | 'workspace-write' | 'danger-full-access'

/** Runtime ACP auto-answer derived from the chat preset. */
export type WorkerPermissionPolicy = 'ask' | 'allow' | 'reject'

/**
 * Fold the last `permission/preset` event from a session log.
 * Missing or unknown events are not an error — callers treat that as
 * the composed chat default (`workspace-write`).
 */
export function parentChatPreset(
  events: ReadonlyArray<{ readonly type?: string; readonly data?: { readonly preset?: unknown } }> | undefined,
): string | undefined {
  if (events === undefined) return undefined
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    const preset = event?.type === 'permission/preset' ? event.data?.preset : undefined
    if (typeof preset === 'string' && preset !== '') return preset
  }
  return undefined
}

/**
 * How a chat preset answers ACP `session/request_permission`.
 * `read-only` never auto-allows. `danger-full-access` auto-allows.
 * Everything else, including an omitted preset, asks.
 */
export function chatPresetToWorkerPolicy(preset: string | undefined): WorkerPermissionPolicy {
  if (preset === 'read-only') return 'reject'
  if (preset === 'danger-full-access') return 'allow'
  return 'ask'
}
