/**
 * Loader identity and Standard Schema config for the ACP worker Host plugin.
 * Kept free of `@deepseek-ai/*` runtime imports so unit tests can load it.
 */
import type { WorkerPermissionPolicy } from '@pihuo/dsh-worker-protocol'

/** Loader display name. The registered provider name is `Config.providerName`. */
export const name = 'acp-worker'

/** Required services: registry + process seam (credential scrub + tree teardown). */
export const inject = ['subagents', 'subprocess']

/** Plugin config. `ask` is phase 2 (`ctx.approval`); phase 1 is auto only. */
export interface Config {
  /** Name on `ctx.subagents`. Default `pihuo-acp` — do not use first-party `acp`. */
  providerName: string
  /** Executable for each run (absolute or on PATH). */
  command: string
  args: string[]
  /**
   * Child cwd and ACP workspace. Absolute after load.
   * Omit to inherit the parent session header cwd.
   */
  cwd?: string
  /** Auto-answer policy for `session/request_permission`. */
  permission: Exclude<WorkerPermissionPolicy, 'ask'>
  /** Extra env merged after the subprocess seam scrubs the parent env. */
  env: Record<string, string>
  /** POSIX SIGTERM→SIGKILL grace, milliseconds. */
  disposeGraceMs: number
}

/**
 * Standard Schema validator Cordis runs before `apply`.
 * Fills defaults; rejects a missing `command` or an empty `cwd` string.
 */
export const Config = {
  '~standard': {
    version: 1 as const,
    vendor: 'pihuo',
    validate(value: unknown) {
      const raw = (value ?? {}) as Partial<Config>
      if (typeof raw.command !== 'string' || raw.command.trim() === '') {
        return { issues: [{ message: 'command is required' }] }
      }
      if (raw.cwd === '') {
        return { issues: [{ message: 'cwd must be omitted or a non-empty path' }] }
      }
      const resolved: Config = {
        providerName: raw.providerName ?? 'pihuo-acp',
        command: raw.command,
        args: raw.args ?? [],
        permission: raw.permission ?? 'reject',
        env: raw.env ?? {},
        disposeGraceMs: raw.disposeGraceMs ?? 3000,
        ...raw.cwd === undefined ? {} : { cwd: raw.cwd },
      }
      return { value: resolved }
    },
  },
}
