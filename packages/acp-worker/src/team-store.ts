/**
 * Per-chat team documents under `$DSH_HOME/pihuo/teams/<sessionId>.json`.
 * Missing file is an empty team. Not a session event.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decodeChatTeam, encodeChatTeam, parseChatTeam, type ChatTeam } from '@pihuo/dsh-worker-protocol'
import { resolvePihuoHome } from './store.js'

/** Filename-safe session id. Unreserved characters stay as-is. */
export function teamFileName(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

/** Absolute path of one chat's team document. */
export function teamFilePath(sessionId: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(resolvePihuoHome(env), 'teams', `${teamFileName(sessionId)}.json`)
}

/** Empty team for a chat that has not assigned anyone. */
export function emptyTeam(sessionId: string): ChatTeam {
  return { sessionId, members: [] }
}

/**
 * Load this chat's team. Missing file is empty, not an error.
 * Corrupt JSON returns empty plus `lastError`.
 */
export function readTeam(
  sessionId: string,
  env: NodeJS.ProcessEnv = process.env,
): ChatTeam & { lastError?: string } {
  if (sessionId.trim() === '') return emptyTeam(sessionId)
  try {
    const decoded = decodeChatTeam(readFileSync(teamFilePath(sessionId, env), 'utf8'), sessionId)
    if ('issues' in decoded) return { ...emptyTeam(sessionId), lastError: decoded.issues.join('; ') }
    return decoded.value
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyTeam(sessionId)
    return {
      ...emptyTeam(sessionId),
      lastError: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Persist this chat's team. Rejects a duplicate workerId.
 * The same role may be bound to many workers.
 */
export function writeTeam(
  sessionId: string,
  next: unknown,
  env: NodeJS.ProcessEnv = process.env,
): ChatTeam & { lastError?: string } {
  const parsed = parseChatTeam(
    typeof next === 'object' && next !== null ? { ...(next as object), sessionId } : { sessionId, members: next },
    sessionId,
  )
  if ('issues' in parsed) return { ...readTeam(sessionId, env), lastError: parsed.issues.join('; ') }
  const path = teamFilePath(sessionId, env)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, encodeChatTeam(parsed.value))
  return parsed.value
}

/**
 * Seat a worker on this chat's team when the Leader starts them.
 * A second start of the same worker keeps the seat, but a later specific
 * role (coder/review/…) replaces an auto `general`. The same role may be
 * bound to many workers.
 */
export function upsertTeamMember(
  sessionId: string,
  member: { readonly workerId: string; readonly role?: string },
  env: NodeJS.ProcessEnv = process.env,
): ChatTeam & { lastError?: string } {
  const current = readTeam(sessionId, env)
  const wanted = member.role !== undefined && member.role !== '' ? member.role : 'general'
  const existing = current.members.find(row => row.workerId === member.workerId)
  if (existing !== undefined) {
    if (existing.role === 'general' && wanted !== 'general') {
      return writeTeam(sessionId, {
        sessionId,
        members: current.members.map(row => row.workerId === member.workerId ? { ...row, role: wanted } : row),
      }, env)
    }
    return current
  }
  return writeTeam(sessionId, {
    sessionId,
    members: [...current.members, { workerId: member.workerId, role: wanted }],
  }, env)
}
