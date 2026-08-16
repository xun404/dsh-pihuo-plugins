/**
 * Loader identity and Standard Schema config for the ACP worker Host plugin.
 * Kept free of `@deepseek-ai/*` runtime imports so unit tests can load it.
 */
/** Loader display name. Inventory id is the patch row `pihuo-acp`. */
export const name = 'pihuo-acp'

/** Required services: registry + process seam (credential scrub + tree teardown). */
export const inject = ['subagents', 'subprocess']

/** Deployment defaults. User file `$DSH_HOME/pihuo/workers.json` overlays these. */
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
        env: raw.env ?? {},
        disposeGraceMs: raw.disposeGraceMs ?? 3000,
        ...raw.cwd === undefined ? {} : { cwd: raw.cwd },
      }
      return { value: resolved }
    },
  },
}
