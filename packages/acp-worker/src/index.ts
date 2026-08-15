/**
 * Host plugin: register `pihuo-acp` on `ctx.subagents`.
 * Spawns an ACP 1.2 CLI through `ctx.subprocess` and returns one SubagentRun.
 * Must not append custom session event types.
 */
import { isAbsolute, resolve } from 'node:path'
import { accessSync, constants, statSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { AcpSessionDriver } from '@pihuo/dsh-acp-protocol'
import { randomUUID } from 'node:crypto'
import { Config, inject, name, type Config as WorkerConfig } from './config.js'

export { Config, inject, name }

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

/**
 * Out-of-process ACP provider.
 * Advertises no start-time capabilities: a remote CLI cannot honor persona,
 * toolFilter, depth, or outputSchema. Does not implement `prepareContinuable`
 * (that path composes an in-process Agent). Phase 1 starts a fresh process
 * per `start()`; reuse is phase 2.
 */
class PihuoAcpProvider implements SubagentProvider {
  readonly capabilities: SubagentCapabilities = {
    outputSchema: false,
    depthLimit: false,
    toolFilter: false,
    persona: false,
  }
  readonly inheritsParentContext = false

  constructor(
    readonly name: string,
    private readonly ctx: Context,
    private readonly config: WorkerConfig,
  ) {}

  async start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    if (request.signal.aborted) throw new Error('acp-worker: aborted before start')
    if (this.config.args.length === 0) {
      throw new Error(
        'acp-worker: config.args is empty — set command/args to an ACP 1.2 CLI (see package README)',
      )
    }
    const cwd = resolveCwd(this.config.cwd, request)
    const id = SessionId(randomUUID())
    const spawn = this.ctx.subprocess.spawn.bind(this.ctx.subprocess) as (spec: SubprocessSpawnSpec) => SubprocessHandle
    const child = spawn({
      argv: [this.config.command, ...this.config.args],
      cwd,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' },
      graceMs: this.config.disposeGraceMs,
      env: this.config.env,
    })
    if (child.stdin === undefined || child.stdout === undefined) {
      await child.done.catch(() => {})
      throw new Error('acp-worker: subprocess dropped protocol pipes')
    }

    let settle!: (value: SubagentResult) => void
    const result = new Promise<SubagentResult>((resolve) => {
      settle = resolve
    })
    let driver: AcpSessionDriver | undefined

    const run = async (): Promise<void> => {
      try {
        driver = await AcpSessionDriver.connect({
          cwd,
          permission: this.config.permission,
          stdin: child.stdin!,
          stdout: child.stdout!,
        })
        await driver.sessionNew()
        const prompt = await driver.prompt(promptText(request), request.signal)
        settle({
          output: prompt.output === '' ? [] : [{ type: 'text', text: prompt.output }],
          stopReason: prompt.stopReason,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.ctx.logger.warn(`acp-worker "${this.name}": ${message}`)
        settle({
          output: [{ type: 'text', text: message }],
          stopReason: request.signal.aborted ? 'aborted' : 'error',
        })
      }
    }

    void run()

    return {
      id,
      localAgent: undefined,
      result,
      dispose: async () => {
        await driver?.cancel()
        child.stdin?.end()
        child.terminate()
        await child.waitForExit().catch(() => {})
      },
    }
  }
}

/**
 * Register `config.providerName` on `ctx.subagents`.
 * Requires `subagents` and `subprocess` already injected. Unload drops the
 * provider; in-flight children are torn down by the subprocess seam.
 */
export function apply(ctx: Context, config: WorkerConfig): void {
  if (config.cwd === '') throw new Error('acp-worker: config cwd must not be empty')
  ctx.subagents.registerProvider(new PihuoAcpProvider(config.providerName, ctx, config))
}
