/**
 * In-process live run board for ACP activity.
 * The chat card polls this. Nothing here is a session event.
 */
import type { WorkerActivity } from '@pihuo/dsh-worker-protocol'

/** One in-flight or just-settled `acp_worker` call. */
export interface LiveRun {
  readonly id: string
  readonly parentSessionId: string
  readonly workerId: string
  readonly title: string
  readonly model?: string
  readonly thinking?: string
  readonly startedAt: number
  readonly settled: boolean
  readonly activities: readonly WorkerActivity[]
}

const RETAIN_SETTLED_MS = 120_000

const runs = new Map<string, LiveRun>()

/**
 * Open a live row. Later {@link appendLive} / {@link settleLive} update it.
 */
export function startLive(run: Omit<LiveRun, 'settled' | 'activities'>): LiveRun {
  const created: LiveRun = { ...run, settled: false, activities: [] }
  runs.set(run.id, created)
  return created
}

/** Write applied model / thinking onto an open run. Pins stay off this board. */
export function patchLive(
  id: string,
  applied: { readonly model?: string; readonly thinking?: string },
): void {
  const current = runs.get(id)
  if (current === undefined || current.settled) return
  runs.set(id, {
    ...current,
    ...applied.model === undefined || applied.model === '' ? {} : { model: applied.model },
    ...applied.thinking === undefined || applied.thinking === '' ? {} : { thinking: applied.thinking },
  })
}

/** Append one ACP activity sample to an open run. */
export function appendLive(id: string, activity: WorkerActivity): void {
  const current = runs.get(id)
  if (current === undefined || current.settled) return
  runs.set(id, { ...current, activities: [...current.activities, activity] })
}

/** Mark the run finished and drop it after {@link RETAIN_SETTLED_MS}. */
export function settleLive(id: string, activities?: readonly WorkerActivity[]): void {
  const current = runs.get(id)
  if (current === undefined) return
  runs.set(id, {
    ...current,
    settled: true,
    activities: activities === undefined ? current.activities : [...activities],
  })
  setTimeout(() => {
    runs.delete(id)
  }, RETAIN_SETTLED_MS).unref?.()
}

/** Drop every run owned by a parent session that just left. */
export function dropLiveParent(parentSessionId: string): void {
  for (const [id, run] of runs) {
    if (run.parentSessionId === parentSessionId) runs.delete(id)
  }
}

/** Live and recently settled runs for one parent session, newest last. */
export function listLive(parentSessionId: string): LiveRun[] {
  return [...runs.values()].filter(run => run.parentSessionId === parentSessionId)
}

/** Test helper. */
export function resetLive(): void {
  runs.clear()
}
