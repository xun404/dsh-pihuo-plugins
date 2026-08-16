/**
 * Host plugin: register `pihuo-acp` on `ctx.subagents`.
 * Spawns or reuses an ACP 1.2 CLI through `ctx.subprocess`.
 * Serves `/pihuo/workers`, `/pihuo/catalog`, `/pihuo/workers/probe`,
 * and `/pihuo/workers/models`
 * when `webServer` is present.
 */
import { isAbsolute, resolve } from 'node:path'
import { accessSync, constants, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { AcpSessionDriver, decideAskPermission } from '@pihuo/dsh-acp-protocol'
import { listWorkerModels } from './list-models.js'
import { probeWorkerAcp } from './probe-acp.js'
import {
  chatPresetToWorkerPolicy,
  parentChatPreset,
  parseWorkerIdHint,
  resolveRosterWorker,
  stripWorkerIdLine,
  type WorkerRosterEntry,
} from '@pihuo/dsh-worker-protocol'
import {
  fingerprintOf,
  PoolFullError,
  WorkerSessionPool,
  type PooledSession,
} from '@pihuo/dsh-worker-runtime'
import { Config, inject, name, type Config as WorkerConfig } from './config.js'
import { handlePihuoHttp } from './http.js'
import { readRoster } from './store.js'

export { Config, inject, name }
export type { WorkerConfig }

function isUsableDir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function resolveCwd(configured: string | undefined, request: ResolvedSubagentStartRequest): string {
  if (configured !== undefined && configured !== '') {
    const abs = isAbsolute(configured) ? configured : resolve(configured)
    if (!isUsableDir(abs)) throw new Error(`acp-worker: config cwd is not usable: ${abs}`)
    return abs
  }
  const parentCwd = request.parent.session.header.cwd
  if (parentCwd === undefined) {
    throw new Error('acp-worker: no cwd — set config.cwd or delegate from a session that has one')
  }
  if (!isAbsolute(parentCwd) || !isUsableDir(parentCwd)) {
    throw new Error(`acp-worker: parent session cwd is not usable: ${parentCwd}`)
  }
  return parentCwd
}

function promptText(request: ResolvedSubagentStartRequest): string {
  return request.prompt
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

function requestLabel(request: ResolvedSubagentStartRequest): string | undefined {
  const label = request.label
  return typeof label === 'string' && label !== '' ? label : undefined
}

function parentSessionId(request: ResolvedSubagentStartRequest): string {
  const id = request.parent.session.id
  if (typeof id === 'string' && id !== '') return id
  throw new Error('acp-worker: parent session has no id')
}

/**
 * Out-of-process ACP provider with an in-process reuse pool.
 * Does not implement `prepareContinuable`.
 */
class PihuoAcpProvider implements SubagentProvider {
  readonly capabilities: SubagentCapabilities = {
    outputSchema: false,
    depthLimit: false,
    toolFilter: false,
    persona: false,
  }
  readonly inheritsParentContext = false
  private pool: WorkerSessionPool | undefined
  private poolStamp = ''

  constructor(
    readonly name: string,
    private readonly ctx: Context,
    private readonly plugin: WorkerConfig,
  ) {}

  poolSize(): number {
    return this.pool?.size ?? 0
  }

  async disposeAll(): Promise<void> {
    await this.pool?.disposeAll()
  }

  /** Drop every child tied to a leader session that just left the store. */
  async disposeParent(parentSessionId: string): Promise<void> {
    await this.pool?.disposeParent(parentSessionId)
  }

  private ensurePool(user: WorkerRosterEntry): WorkerSessionPool {
    const stamp = `${user.idleTtlMs}:${user.poolMax}`
    if (this.pool !== undefined && this.poolStamp === stamp) return this.pool
    void this.pool?.disposeAll()
    this.pool = new WorkerSessionPool({ idleTtlMs: user.idleTtlMs, poolMax: user.poolMax })
    this.poolStamp = stamp
    return this.pool
  }

  async start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    if (request.signal.aborted) throw new Error('acp-worker: aborted before start')
    const roster = readRoster(this.plugin)
    if (roster.lastError !== undefined) {
      throw new Error(`acp-worker: ${roster.lastError}`)
    }
    const rawPrompt = promptText(request)
    const picked = resolveRosterWorker(roster.workers, parseWorkerIdHint(rawPrompt, requestLabel(request)))
    if ('issues' in picked) throw new Error(`acp-worker: ${picked.issues.join('; ')}`)
    const user = picked.value
    if (user.command === 'node' && user.args.length === 0) {
      throw new Error('acp-worker: set command/args in PiHuo Workers settings')
    }
    const childPrompt = stripWorkerIdLine(rawPrompt)
    const cwd = resolveCwd(this.plugin.cwd, request)
    const fingerprint = fingerprintOf({
      command: user.command,
      args: user.args,
      ...user.model === undefined ? {} : { model: user.model },
      envNames: Object.keys(this.plugin.env),
    })
    const pool = this.ensurePool(user)
    const id = randomUUID() as SessionId
    let session: PooledSession | undefined
    let settle!: (value: SubagentResult) => void
    const result = new Promise<SubagentResult>((resolveResult) => {
      settle = resolveResult
    })

    const run = async (): Promise<void> => {
      try {
        session = await pool.acquire({
          parentSessionId: parentSessionId(request),
          workerId: user.id,
          revision: String(roster.revision),
          cwd,
          fingerprint,
        }, {
          create: () => this.spawnSession(user, cwd, request, (dead) => {
            pool.markBroken(dead)
          }),
        })
        const prompt = await session.prompt(childPrompt, request.signal)
        const chatPreset = parentChatPreset(request.parent.session.events)
        const safeTitle = user.title.replace(/["\n]/g, ' ').trim()
        const header = `[acp_worker id="${user.id}" title="${safeTitle}" chat="${chatPreset ?? 'workspace-write'}" stop="${prompt.stopReason}"]`
        const body = prompt.output.trim()
        settle({
          output: [{ type: 'text', text: body === '' ? header : `${header}\n${body}` }],
          stopReason: prompt.stopReason,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!(error instanceof PoolFullError)) {
          this.ctx.logger.warn(`acp-worker "${this.name}": ${message}`)
        }
        settle({
          output: [{ type: 'text', text: message }],
          stopReason: request.signal.aborted ? 'aborted' : 'error',
        })
      } finally {
        if (session !== undefined) pool.release(session)
      }
    }

    void run()

    return {
      id,
      localAgent: undefined,
      result,
      dispose: async () => {
        await session?.cancel()
      },
    }
  }

  private async spawnSession(
    user: WorkerRosterEntry,
    cwd: string,
    request: ResolvedSubagentStartRequest,
    onDead: (session: PooledSession) => void,
  ): Promise<PooledSession> {
    const spawn = this.ctx.subprocess.spawn.bind(this.ctx.subprocess) as (spec: SubprocessSpawnSpec) => SubprocessHandle
    const env = { ...this.plugin.env }
    if (user.model !== undefined) env.OPENCODE_MODEL = user.model
    const child = spawn({
      argv: [user.command, ...user.args],
      cwd,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' },
      graceMs: this.plugin.disposeGraceMs,
      env,
    })
    if (child.stdin === undefined || child.stdout === undefined) {
      await child.done.catch(() => {})
      throw new Error('acp-worker: subprocess dropped protocol pipes')
    }
    const approval = this.ctx.get?.('approval') as Context['approval'] | undefined
    const chatPreset = parentChatPreset(request.parent.session.events)
    const permission = chatPresetToWorkerPolicy(chatPreset)
    const driver = await AcpSessionDriver.connect({
      cwd,
      permission,
      stdin: child.stdin,
      stdout: child.stdout,
      ...permission === 'ask'
        ? {
          askPermission: async (options) => decideAskPermission(options, async () => {
            if (approval === undefined) return 'unavailable'
            try {
              return await approval.request({
                agent: request.parent,
                toolName: 'acp_worker',
                reason: `ACP worker "${user.title}" asked to continue (${chatPreset ?? 'workspace-write'})`,
                signal: request.signal,
              })
            } catch {
              return 'unavailable'
            }
          }),
        }
        : {},
    })
    const created = await driver.sessionNew()
    if (user.model !== undefined && created.modelConfigId !== undefined) {
      await driver.setConfigOption(created.modelConfigId, user.model).catch(() => {})
    }
    const session: PooledSession = {
      prompt: (text, signal) => driver.prompt(text, signal),
      cancel: () => driver.cancel(),
      dispose: async () => {
        await driver.cancel()
        child.stdin?.end()
        child.terminate()
        await child.waitForExit().catch(() => {})
      },
    }
    void child.done.then(
      () => { onDead(session) },
      () => { onDead(session) },
    )
    return session
  }
}

/**
 * Register `config.providerName` on `ctx.subagents`.
 * Requires `subagents` and `subprocess`. `webServer` and `approval` are optional:
 * missing web skips `/pihuo/workers`; missing approval cancels chat-derived `ask`.
 * Plugin unload and `session/disposed` tear the in-process pool.
 */
export function apply(ctx: Context, config: WorkerConfig): void {
  if (config.cwd === '') throw new Error('acp-worker: config cwd must not be empty')
  const provider = new PihuoAcpProvider(config.providerName, ctx, config)
  ctx.subagents.registerProvider(provider)
  ctx.on('session/disposed', (session) => {
    if (typeof session.id === 'string' && session.id !== '') {
      void provider.disposeParent(session.id)
    }
  })
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt?.section({
      name: 'pihuo-workers',
      order: 125,
      text: () => {
        const roster = readRoster(config)
        const ready = roster.workers.filter(row => row.enabled && row.trusted)
        if (ready.length === 0) {
          return 'ACP workers: none are enabled and trusted. The user must add a row in Settings → ACP Worker and check Trusted.'
        }
        const lines = ready.map(row => `- ${row.id} (${row.title}): ${row.command} ${row.args.join(' ')}`.trimEnd())
        const hint = ready.length > 1
          ? 'When more than one worker is listed, begin the acp_worker prompt with a line `workerId: <id>` then the task.'
          : 'There is one ready worker; omit workerId unless you want to name it.'
        return `ACP workers (acp_worker):\n${lines.join('\n')}\n${hint}`
      },
    })
  })
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer!.register({
        kind: 'prefix',
        path: '/pihuo',
        handler: (req: IncomingMessage, res: ServerResponse) => {
          void handlePihuoHttp(
            req,
            res,
            config,
            () => ({ poolSize: provider.poolSize() }),
            undefined,
            input => listWorkerModels(ctx, config, input),
            input => probeWorkerAcp(ctx, config, input),
          )
        },
      }),
      'pihuo-workers: http',
    )
  })
  ctx.effect(() => () => {
    void provider.disposeAll()
  }, 'pihuo-workers: pool')
}
