/**
 * In-process worker session pool.
 * Same reuse key serializes prompts onto one child. Different keys spawn up
 * to `poolMax` children; a full pool evicts the least-recent idle entry or
 * fails loud. Nothing is persisted across process restarts.
 */
import type { WorkerPromptResult, WorkerReuseKey } from '@pihuo/dsh-worker-protocol'
import { reuseKeyId } from './fingerprint.js'

export type PoolEntryState = 'starting' | 'idle' | 'running' | 'closing' | 'broken'

/** One live ACP (or fake) session the pool can prompt and later dispose. */
export interface PooledSession {
  prompt(text: string, signal?: AbortSignal): Promise<WorkerPromptResult>
  cancel(): Promise<void>
  dispose(): Promise<void>
}

export interface SessionFactory {
  create(): Promise<PooledSession>
}

export class PoolFullError extends Error {
  constructor() {
    super('acp-worker: session pool is full (no idle entry to evict)')
    this.name = 'PoolFullError'
  }
}

interface LiveEntry {
  readonly key: WorkerReuseKey
  readonly id: string
  state: PoolEntryState
  session: PooledSession | undefined
  lastUsedAt: number
  queue: Array<() => void>
  idleTimer: (() => void) | undefined
}

export interface WorkerSessionPoolOptions {
  readonly idleTtlMs: number
  readonly poolMax: number
  readonly now?: () => number
  /** Returns a disposer that cancels the scheduled callback. */
  readonly schedule?: (fn: () => void, ms: number) => () => void
}

/**
 * Process-local pool keyed by {@link reuseKeyId}.
 * `acquire` yields a checkout that must be `release`d after `prompt`.
 */
export class WorkerSessionPool {
  private readonly entries = new Map<string, LiveEntry>()
  private readonly now: () => number
  private readonly schedule: (fn: () => void, ms: number) => () => void

  constructor(private readonly opts: WorkerSessionPoolOptions) {
    this.now = opts.now ?? Date.now
    this.schedule = opts.schedule ?? ((fn, ms) => {
      const t = setTimeout(fn, ms)
      return () => clearTimeout(t)
    })
  }

  get size(): number {
    return this.entries.size
  }

  /**
   * Borrow a session for one prompt. Caller must `release` in a finally.
   * @throws {PoolFullError} when every slot is busy.
   */
  async acquire(key: WorkerReuseKey, factory: SessionFactory): Promise<PooledSession> {
    const id = reuseKeyId(key)
    const existing = this.entries.get(id)
    if (existing !== undefined && existing.state !== 'broken' && existing.state !== 'closing') {
      return this.checkout(existing)
    }
    if (existing !== undefined) {
      await this.evict(existing)
      return this.acquire(key, factory)
    }
    // Reserve before any await so a same-key peer queues on `starting`.
    const entry: LiveEntry = {
      key,
      id,
      state: 'starting',
      session: undefined,
      lastUsedAt: this.now(),
      queue: [],
      idleTimer: undefined,
    }
    this.entries.set(id, entry)
    try {
      await this.ensureCapacity()
      entry.session = await factory.create()
      entry.state = 'idle'
    } catch (error) {
      entry.state = 'closing'
      this.entries.delete(id)
      for (const wait of entry.queue) wait()
      entry.queue = []
      throw error
    }
    return this.checkout(entry)
  }

  /** Mark the session idle so the next same-key acquire can reuse it. */
  release(session: PooledSession): void {
    const entry = this.findBySession(session)
    if (entry === undefined) return
    if (entry.state === 'broken' || entry.state === 'closing') return
    entry.state = 'idle'
    entry.lastUsedAt = this.now()
    const next = entry.queue.shift()
    if (next !== undefined) {
      next()
      return
    }
    this.armIdle(entry)
  }

  /** Drop every entry whose parent session matches. */
  async disposeParent(parentSessionId: string): Promise<void> {
    const matches = [...this.entries.values()].filter(entry => entry.key.parentSessionId === parentSessionId)
    await Promise.all(matches.map(entry => this.evict(entry)))
  }

  async disposeAll(): Promise<void> {
    await Promise.all([...this.entries.values()].map(entry => this.evict(entry)))
  }

  markBroken(session: PooledSession): void {
    const entry = this.findBySession(session)
    if (entry === undefined) return
    entry.state = 'broken'
    this.clearIdle(entry)
  }

  private async checkout(entry: LiveEntry): Promise<PooledSession> {
    if (entry.state === 'idle' && entry.session !== undefined) {
      this.clearIdle(entry)
      entry.state = 'running'
      entry.lastUsedAt = this.now()
      return entry.session
    }
    if (entry.state === 'starting' || entry.state === 'running') {
      await new Promise<void>((resolve) => {
        entry.queue.push(resolve)
      })
      return this.checkout(entry)
    }
    throw new Error(`acp-worker: pool entry is ${entry.state}`)
  }

  private async ensureCapacity(): Promise<void> {
    while (this.entries.size > this.opts.poolMax) {
      const idle = [...this.entries.values()]
        .filter(entry => entry.state === 'idle')
        .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
      const victim = idle[0]
      if (victim === undefined) throw new PoolFullError()
      await this.evict(victim)
    }
  }

  private armIdle(entry: LiveEntry): void {
    this.clearIdle(entry)
    entry.idleTimer = this.schedule(() => {
      void this.evict(entry)
    }, this.opts.idleTtlMs)
  }

  private clearIdle(entry: LiveEntry): void {
    entry.idleTimer?.()
    entry.idleTimer = undefined
  }

  private async evict(entry: LiveEntry): Promise<void> {
    this.clearIdle(entry)
    entry.state = 'closing'
    this.entries.delete(entry.id)
    for (const wait of entry.queue) wait()
    entry.queue = []
    try {
      await entry.session?.cancel()
      await entry.session?.dispose()
    } catch {
      // Eviction must not fail the next acquire.
    }
  }

  private findBySession(session: PooledSession): LiveEntry | undefined {
    return [...this.entries.values()].find(entry => entry.session === session)
  }
}
