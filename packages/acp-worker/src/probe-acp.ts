/**
 * One-shot ACP setup probe: spawn → initialize → session/new → kill.
 * Same gate pihuo-agent uses before persisting a worker. Does not join the pool.
 */
import { isAbsolute, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import {
  AcpProtocolError,
  AcpSessionDriver,
  extractReasoningSelector,
  type WorkerModelOption,
  type WorkerReasoningSelector,
} from '@pihuo/dsh-acp-protocol'
import { binaryNameFromPackageSpec, packageSpecFromArgs } from '@pihuo/dsh-worker-protocol'
import type { Config as PluginConfig } from './config.js'
import { probeCommand } from './probe.js'

export interface ProbeAcpInput {
  readonly command: string
  readonly args?: readonly string[]
  /** When set, pin this model before reading thought-level. */
  readonly model?: string
}

export type AcpProbeStatus = 'ready' | 'auth_required' | 'incompatible' | 'failed'

export interface AcpProbeResult {
  readonly ok: boolean
  readonly status: AcpProbeStatus
  readonly code: string
  readonly message: string
  readonly models: readonly WorkerModelOption[]
  readonly currentModelId?: string
  readonly reasoning?: WorkerReasoningSelector
  readonly agentName?: string
  readonly agentVersion?: string
  readonly protocolVersion?: number
}

const PROBE_TIMEOUT_MS = 20_000

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`${label} timed out`), { code: 'PROBE_TIMEOUT' }))
    }, PROBE_TIMEOUT_MS)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const PACKAGE_RUNNERS = new Set(['npx', 'npm', 'pnpm', 'bunx', 'uvx', 'yarn'])

function isPackageRunner(command: string): boolean {
  const base = command.split(/[/\\]/).pop() ?? command
  return PACKAGE_RUNNERS.has(base.replace(/\.cmd$/i, '').toLowerCase())
}

function argsAfterPackage(args: readonly string[], spec: string): string[] {
  const index = args.indexOf(spec)
  if (index === -1) return []
  return args.slice(index + 1)
}

export type ProbeLaunch =
  | { readonly command: string; readonly args: readonly string[] }
  | { readonly missing: string }

/**
 * Resolve what to spawn for a probe.
 * Package runners (`npx -y …`) are not launched: that would download.
 * If the package's binary is already on PATH, probe that instead.
 */
export function resolveProbeLaunch(command: string, args: readonly string[]): ProbeLaunch {
  const trimmed = command.trim()
  if (trimmed === '') return { missing: 'command' }
  if (!isPackageRunner(trimmed)) {
    return probeCommand(trimmed).found ? { command: trimmed, args } : { missing: trimmed }
  }
  const spec = packageSpecFromArgs(args)
  const bin = spec === undefined ? undefined : binaryNameFromPackageSpec(spec)
  if (bin !== undefined && probeCommand(bin).found) {
    return { command: bin, args: spec === undefined ? [...args] : argsAfterPackage(args, spec) }
  }
  return { missing: spec ?? trimmed }
}

function probeCwd(plugin: PluginConfig): string {
  if (plugin.cwd !== undefined && plugin.cwd !== '') {
    return isAbsolute(plugin.cwd) ? plugin.cwd : resolve(plugin.cwd)
  }
  return process.cwd()
}

function readAuthReason(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const rec = error as { data?: unknown; message?: unknown }
  if (typeof rec.data === 'object' && rec.data !== null) {
    const reason = (rec.data as { reason?: unknown }).reason
    if (typeof reason === 'string') return reason
  }
  return undefined
}

/**
 * Map a thrown handshake error to a public probe result.
 */
export function classifyProbeFailure(error: unknown): Pick<AcpProbeResult, 'status' | 'code' | 'message'> {
  if (error instanceof AcpProtocolError && error.code === 'protocol_incompatible') {
    return { status: 'incompatible', code: 'ACP_PROTOCOL_INCOMPATIBLE', message: error.message }
  }
  const rec = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : {}
  const code = typeof rec.code === 'string' ? rec.code : undefined
  const message = error instanceof Error ? error.message : String(error)
  if (code === 'PROBE_TIMEOUT' || /timed out/i.test(message)) {
    return {
      status: 'failed',
      code: 'PROBE_TIMEOUT',
      message: 'No ACP handshake in time. The CLI may be missing or not speak ACP.',
    }
  }
  if (code === 'PROCESS_EXITED') {
    return { status: 'failed', code: 'PROCESS_EXITED', message: 'ACP process exited during setup' }
  }
  if (code === 'ENOENT' || /not found|ENOENT/i.test(message)) {
    return { status: 'failed', code: 'ACP_RUNNER_MISSING', message: 'Command not found' }
  }
  if (readAuthReason(error) === 'auth_required' || /auth[_ ]required|authentication required/i.test(message)) {
    return {
      status: 'auth_required',
      code: 'WORKER_AUTH_REQUIRED',
      message: 'Agent requires authentication before session/new',
    }
  }
  if (/session\/new|session new/i.test(message)) {
    return { status: 'failed', code: 'SESSION_FAILED', message: 'ACP session/new failed' }
  }
  return { status: 'failed', code: 'INITIALIZE_FAILED', message }
}

function resultOf(
  parts: Pick<AcpProbeResult, 'ok' | 'status' | 'code' | 'message'> & Partial<AcpProbeResult>,
): AcpProbeResult {
  return {
    ok: parts.ok,
    status: parts.status,
    code: parts.code,
    message: parts.message,
    models: parts.models ?? [],
    ...parts.currentModelId === undefined ? {} : { currentModelId: parts.currentModelId },
    ...parts.reasoning === undefined ? {} : { reasoning: parts.reasoning },
    ...parts.agentName === undefined ? {} : { agentName: parts.agentName },
    ...parts.agentVersion === undefined ? {} : { agentVersion: parts.agentVersion },
    ...parts.protocolVersion === undefined ? {} : { protocolVersion: parts.protocolVersion },
  }
}

/**
 * Spawn a throwaway ACP child and report whether initialize + session/new work.
 */
export async function probeWorkerAcp(
  ctx: Context,
  plugin: PluginConfig,
  input: ProbeAcpInput,
): Promise<AcpProbeResult> {
  const requested = input.command.trim()
  const requestedArgs = [...(input.args ?? [])]
  if (requested === '' || (requested === 'node' && requestedArgs.length === 0)) {
    return resultOf({
      ok: false,
      status: 'failed',
      code: 'ACP_RUNNER_MISSING',
      message: 'set command first',
    })
  }
  const launch = resolveProbeLaunch(requested, requestedArgs)
  if ('missing' in launch) {
    return resultOf({
      ok: false,
      status: 'failed',
      code: 'ACP_RUNNER_MISSING',
      message: launch.missing,
    })
  }
  const command = launch.command
  const args = [...launch.args]
  const cwd = probeCwd(plugin)
  const spawn = ctx.subprocess.spawn.bind(ctx.subprocess) as (spec: SubprocessSpawnSpec) => SubprocessHandle
  let child: SubprocessHandle
  try {
    child = spawn({
      argv: [command, ...args],
      cwd,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' },
      graceMs: plugin.disposeGraceMs,
      env: { ...plugin.env },
    })
  } catch (error) {
    return resultOf({ ok: false, ...classifyProbeFailure(error) })
  }
  let finished = false
  try {
    if (child.stdin === undefined || child.stdout === undefined) {
      return resultOf({
        ok: false,
        status: 'failed',
        code: 'SPAWN_FAILED',
        message: 'subprocess dropped protocol pipes',
      })
    }
    const handshake = (async () => {
      const driver = await withTimeout(AcpSessionDriver.connect({
        cwd,
        permission: 'reject',
        stdin: child.stdin!,
        stdout: child.stdout!,
      }), 'ACP initialize')
      const listed = await withTimeout(driver.sessionNew(), 'ACP session/new')
      if (input.model !== undefined && input.model !== '' && listed.modelConfigId !== undefined) {
        await withTimeout(driver.setConfigOption(listed.modelConfigId, input.model), 'ACP set model')
      }
      const reasoning = extractReasoningSelector(driver.configOptions)
      const info = driver.agentInfo
      return resultOf({
        ok: true,
        status: 'ready',
        code: 'SESSION_READY',
        message: 'Initialize and session/new succeeded',
        models: [...listed.models],
        ...listed.currentModelId === undefined && input.model === undefined
          ? {}
          : { currentModelId: input.model ?? listed.currentModelId },
        ...reasoning === undefined ? {} : { reasoning },
        ...info?.agentName === undefined ? {} : { agentName: info.agentName },
        ...info?.agentVersion === undefined ? {} : { agentVersion: info.agentVersion },
        ...info === undefined ? {} : { protocolVersion: info.protocolVersion },
      })
    })()
    const died = new Promise<never>((_, reject) => {
      void child.done.then(
        () => {
          if (!finished) {
            reject(Object.assign(new Error('ACP process exited during setup'), { code: 'PROCESS_EXITED' }))
          }
        },
        (error: unknown) => {
          if (!finished) reject(error)
        },
      )
    })
    const probed = await Promise.race([handshake, died])
    finished = true
    return probed
  } catch (error) {
    finished = true
    return resultOf({ ok: false, ...classifyProbeFailure(error) })
  } finally {
    finished = true
    child.stdin?.end()
    child.terminate()
    await child.waitForExit().catch(() => {})
  }
}
