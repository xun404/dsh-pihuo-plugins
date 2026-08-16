/**
 * Pick one roster row for an `acp_worker` call and strip the optional
 * `workerId:` hint from the prompt the child sees.
 */
import { WORKER_ID_PATTERN, type WorkerRosterEntry } from './config.js'

const HINT = /^(?:workerId|pihuo-worker-id)\s*:\s*([a-z][a-z0-9_-]*)\s*(?:\r?\n|$)/i

export { WORKER_ID_PATTERN }

/**
 * Read an optional worker id from the prompt's first line or from the tool
 * `label` when that label is itself a legal id.
 */
export function parseWorkerIdHint(prompt: string, label?: string): string | undefined {
  const matched = prompt.match(HINT)
  if (matched?.[1] !== undefined) return matched[1].toLowerCase()
  if (label !== undefined && WORKER_ID_PATTERN.test(label)) return label
  return undefined
}

/**
 * Remove a leading `workerId:` / `pihuo-worker-id:` line so the ACP child
 * does not see the routing hint.
 */
export function stripWorkerIdLine(prompt: string): string {
  return prompt.replace(HINT, '')
}

/**
 * Choose the roster row this call should spawn.
 * A hint must name an enabled and trusted row. With no hint: the only
 * enabled+trusted row, else `default` when that row is enabled+trusted.
 * Otherwise the caller must send `workerId:`.
 */
export function resolveRosterWorker(
  workers: readonly WorkerRosterEntry[],
  hint?: string,
): { value: WorkerRosterEntry } | { issues: string[] } {
  const ready = workers.filter(row => row.enabled && row.trusted)
  if (hint !== undefined && hint !== '') {
    const row = workers.find(item => item.id === hint)
    if (row === undefined) return { issues: [`unknown workerId "${hint}"`] }
    if (!row.enabled) return { issues: [`worker "${hint}" is disabled`] }
    if (!row.trusted) return { issues: [`worker "${hint}" is not trusted`] }
    return { value: row }
  }
  if (ready.length === 1) {
    const only = ready[0]
    if (only === undefined) return { issues: ['no trusted enabled worker'] }
    return { value: only }
  }
  const fallback = ready.find(row => row.id === 'default')
  if (fallback !== undefined) return { value: fallback }
  if (ready.length === 0) {
    return { issues: ['no trusted enabled worker — add one in PiHuo Workers and check 已信任'] }
  }
  const ids = ready.map(row => row.id).join(', ')
  return { issues: [`multiple workers are ready; begin the prompt with workerId: <id> (${ids})`] }
}
