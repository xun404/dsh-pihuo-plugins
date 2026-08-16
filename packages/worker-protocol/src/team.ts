/**
 * Per-chat team: registered workers plus the role they play in this session.
 * Stored under `$DSH_HOME/pihuo/teams/<sessionId>.json`. Not a session event.
 */

import { WORKER_ID_PATTERN } from './config.js'

/** Role token on a team member and in a `role:` dispatch hint. */
export const TEAM_ROLE_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/

/** Built-in roles the header offers. Custom tokens still match {@link TEAM_ROLE_PATTERN}. */
export const TEAM_ROLES = ['general', 'coder', 'review', 'research'] as const

export type TeamRole = (typeof TEAM_ROLES)[number]

/**
 * One assignment of a roster worker to this chat.
 * Optional `model` / `reasoning` override the worker defaults for this role.
 */
export interface TeamMember {
  /** Roster row this seat uses. */
  readonly workerId: string
  /** Dispatch key (`role: coder`) and the label the Leader sees. */
  readonly role: string
  /** Model override. Omitted inherits the worker default, then the agent default. */
  readonly model?: string
  /** Thought-level override. Omitted inherits the worker default, then the agent default. */
  readonly reasoning?: string
}

/** One chat's team document. */
export interface ChatTeam {
  readonly sessionId: string
  readonly members: readonly TeamMember[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/**
 * Validate one team seat. `workerId` must be a roster id. `role` must match
 * {@link TEAM_ROLE_PATTERN}.
 */
export function parseTeamMember(raw: unknown): { value: TeamMember } | { issues: string[] } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const issues: string[] = []
  const workerId = asString(obj.workerId) ?? ''
  if (!WORKER_ID_PATTERN.test(workerId)) issues.push('workerId must match [a-z][a-z0-9_-]{0,63}')
  const role = asString(obj.role) ?? ''
  if (!TEAM_ROLE_PATTERN.test(role)) issues.push('role must match [a-z][a-z0-9_-]{0,31}')
  if (issues.length > 0) return { issues }
  const model = asString(obj.model)
  const reasoning = asString(obj.reasoning)
  return {
    value: {
      workerId,
      role,
      ...model === undefined ? {} : { model },
      ...reasoning === undefined ? {} : { reasoning },
    },
  }
}

/**
 * Validate a team. Duplicate `workerId` fail (one seat per worker).
 * The same role may be bound to many workers. Empty is legal.
 */
export function parseChatTeam(raw: unknown, sessionId?: string): { value: ChatTeam } | { issues: string[] } {
  const obj = (raw ?? {}) as Record<string, unknown>
  const id = asString(obj.sessionId) ?? sessionId ?? ''
  if (id === '') return { issues: ['sessionId is required'] }
  const list = obj.members
  if (list !== undefined && !Array.isArray(list)) return { issues: ['members must be an array'] }
  const members: TeamMember[] = []
  const seenWorkers = new Set<string>()
  const issues: string[] = []
  for (const [index, item] of (list ?? []).entries()) {
    const parsed = parseTeamMember(item)
    if ('issues' in parsed) {
      issues.push(`members[${String(index)}]: ${parsed.issues.join('; ')}`)
      continue
    }
    if (seenWorkers.has(parsed.value.workerId)) {
      issues.push(`duplicate workerId "${parsed.value.workerId}"`)
      continue
    }
    seenWorkers.add(parsed.value.workerId)
    members.push(parsed.value)
  }
  if (issues.length > 0) return { issues }
  return { value: { sessionId: id, members } }
}

/** Serialize one chat team. */
export function encodeChatTeam(team: ChatTeam): string {
  return `${JSON.stringify({ version: 1, sessionId: team.sessionId, members: team.members }, null, 2)}\n`
}

/**
 * Parse a team document. Missing `version` is treated as 1.
 */
export function decodeChatTeam(text: string, sessionId?: string): { value: ChatTeam } | { issues: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    return { issues: ['team file is not valid JSON'] }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { issues: ['team file must be an object'] }
  }
  const doc = raw as Record<string, unknown>
  if (doc.version !== undefined && doc.version !== 1) {
    return { issues: [`unsupported team version: ${String(doc.version)}`] }
  }
  return parseChatTeam(doc, sessionId)
}
