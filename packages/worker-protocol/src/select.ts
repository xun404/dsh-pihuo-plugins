/**
 * Pick one roster row for an `acp_worker` call and strip the optional
 * `workerId:` / `role:` hints from the prompt the child sees.
 */
import { WORKER_ID_PATTERN, type WorkerRosterEntry } from './config.js'
import { TEAM_ROLE_PATTERN, TEAM_ROLES, type TeamMember } from './team.js'

const WORKER_LINE = /^(?:workerId|pihuo-worker-id)\s*:\s*([a-z][a-z0-9_-]*)\s*$/i
const ROLE_LINE = /^(?:role|角色)\s*[:：]\s*([^\s]+)\s*$/i

const ROLE_ALIASES: Record<string, string> = {
  general: 'general',
  通用: 'general',
  coder: 'coder',
  编码: 'coder',
  开发: 'coder',
  review: 'review',
  审查: 'review',
  评审: 'review',
  research: 'research',
  调研: 'research',
  研究: 'research',
}

function mapRoleToken(raw: string): string | undefined {
  const key = raw.trim().toLowerCase()
  if (ROLE_ALIASES[key] !== undefined) return ROLE_ALIASES[key]
  if (TEAM_ROLE_PATTERN.test(key) && (TEAM_ROLES as readonly string[]).includes(key)) return key
  return undefined
}

export { WORKER_ID_PATTERN }

/** Routing lines the Leader may put at the top of an `acp_worker` prompt. */
export interface DispatchHint {
  readonly workerId?: string
  readonly role?: string
}

/**
 * Read optional `workerId:` / `role:` lines from the start of the prompt.
 * A legal tool `label` fills `workerId` when the prompt has no worker hint.
 */
export function parseDispatchHint(prompt: string, label?: string): DispatchHint {
  let workerId: string | undefined
  let role: string | undefined
  for (const line of prompt.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const workerMatch = WORKER_LINE.exec(trimmed)
    if (workerMatch?.[1] !== undefined) {
      workerId = workerMatch[1].toLowerCase()
      continue
    }
    const roleMatch = ROLE_LINE.exec(trimmed)
    if (roleMatch?.[1] !== undefined) {
      const mapped = mapRoleToken(roleMatch[1])
      if (mapped !== undefined) {
        role = mapped
        continue
      }
    }
    break
  }
  const labelRole = label === undefined ? undefined : mapRoleToken(label)
  if (role === undefined && labelRole !== undefined) role = labelRole
  if (workerId === undefined && label !== undefined && labelRole === undefined && WORKER_ID_PATTERN.test(label)) {
    workerId = label
  }
  return {
    ...workerId === undefined ? {} : { workerId },
    ...role === undefined ? {} : { role },
  }
}

/**
 * Read an optional worker id from the prompt's first line or from the tool
 * `label` when that label is itself a legal id.
 */
export function parseWorkerIdHint(prompt: string, label?: string): string | undefined {
  return parseDispatchHint(prompt, label).workerId
}

/**
 * Role for auto-seating a team member.
 * Uses `role:` / `角色:` lines, then a label that is itself a known role.
 */
export function inferTeamRole(prompt: string, label?: string): string | undefined {
  return parseDispatchHint(prompt, label).role
}

/**
 * Remove leading `workerId:` / `role:` lines so the ACP child does not see
 * the routing hints.
 */
export function stripWorkerIdLine(prompt: string): string {
  const lines = prompt.split(/\r?\n/)
  let index = 0
  while (index < lines.length) {
    const trimmed = (lines[index] ?? '').trim()
    if (trimmed === '' && index === 0) {
      index += 1
      continue
    }
    if (WORKER_LINE.test(trimmed) || ROLE_LINE.test(trimmed)) {
      index += 1
      continue
    }
    break
  }
  return lines.slice(index).join('\n')
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

export interface DispatchResolution {
  readonly worker: WorkerRosterEntry
  readonly member?: TeamMember
  readonly model?: string
  readonly reasoning?: string
}

/**
 * Choose the roster row and effective model/reasoning for one call.
 * `workerId:` wins. Otherwise `role:` looks up this chat's team. The same
 * role may match several workers — then the caller must send `workerId:`.
 * A one-member team needs no hint. No team falls back to {@link resolveRosterWorker}.
 */
export function resolveDispatch(
  workers: readonly WorkerRosterEntry[],
  team: readonly TeamMember[],
  hint: DispatchHint,
): { value: DispatchResolution } | { issues: string[] } {
  if (hint.workerId !== undefined) {
    const picked = resolveRosterWorker(workers, hint.workerId)
    if ('issues' in picked) return picked
    const member = team.find(row => row.workerId === picked.value.id)
    return { value: effectiveDispatch(picked.value, member) }
  }
  if (hint.role !== undefined) {
    const matches = team.filter(row => row.role === hint.role)
    if (matches.length === 0) return { issues: [`no team member has role "${hint.role}"`] }
    if (matches.length > 1) {
      const ids = matches.map(row => row.workerId).join(', ')
      return { issues: [`role "${hint.role}" is bound to several workers; begin with workerId: <id> (${ids})`] }
    }
    const member = matches[0]
    if (member === undefined) return { issues: [`no team member has role "${hint.role}"`] }
    const picked = resolveRosterWorker(workers, member.workerId)
    if ('issues' in picked) return picked
    return { value: effectiveDispatch(picked.value, member) }
  }
  if (team.length === 1) {
    const member = team[0]
    if (member === undefined) return { issues: ['empty team'] }
    const picked = resolveRosterWorker(workers, member.workerId)
    if ('issues' in picked) return picked
    return { value: effectiveDispatch(picked.value, member) }
  }
  if (team.length > 1) {
    const roles = team.map(row => `${row.role}→${row.workerId}`).join(', ')
    return { issues: [`this chat has several team members; begin with workerId: <id> or role: <role> (${roles})`] }
  }
  const picked = resolveRosterWorker(workers, undefined)
  if ('issues' in picked) return picked
  return { value: effectiveDispatch(picked.value, undefined) }
}

function effectiveDispatch(worker: WorkerRosterEntry, member: TeamMember | undefined): DispatchResolution {
  const model = member?.model ?? worker.model
  const reasoning = member?.reasoning ?? worker.reasoning
  return {
    worker,
    ...member === undefined ? {} : { member },
    ...model === undefined ? {} : { model },
    ...reasoning === undefined ? {} : { reasoning },
  }
}
