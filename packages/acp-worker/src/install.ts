/**
 * User-started install of an ACP CLI into `$DSH_HOME/pihuo/agents/<id>`.
 * Only npm/uv package specs from the catalog. No shell. Logs are for the overlay.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { probeCommand } from './probe.js'
import { resolvePihuoHome } from './store.js'

export interface InstallRequest {
  readonly workerId: string
  readonly packageSpec: string
  readonly distribution: 'npx' | 'uvx'
  readonly commandName: string
}

export type InstallJobStatus = 'running' | 'ok' | 'failed'

export interface InstallJob {
  readonly id: string
  readonly status: InstallJobStatus
  readonly log: string
  readonly command?: string
  readonly error?: string
}

const jobs = new Map<string, InstallJob>()
const MAX_LOG = 200_000
const INSTALL_TIMEOUT_MS = 5 * 60_000

/** Safe npm/uv package token. No spaces, no path traversal. */
export function validatePackageSpec(spec: string): boolean {
  return /^(@[A-Za-z0-9._~-]+\/)?[A-Za-z0-9._~-]+(@[A-Za-z0-9._+-]+|==[A-Za-z0-9._+-]+)?$/.test(spec)
}

function safeWorkerId(id: string): string {
  return /^[a-z][a-z0-9_-]{0,63}$/.test(id) ? id : 'worker'
}

function appendLog(job: InstallJob, chunk: string): InstallJob {
  const next = `${job.log}${chunk}`
  const log = next.length > MAX_LOG ? next.slice(next.length - MAX_LOG) : next
  const updated = { ...job, log }
  jobs.set(job.id, updated)
  return updated
}

function finish(job: InstallJob, patch: Partial<InstallJob>): InstallJob {
  const updated = { ...job, ...patch }
  jobs.set(job.id, updated)
  return updated
}

export function getInstallJob(id: string): InstallJob | undefined {
  return jobs.get(id)
}

export interface LocateWorkerOpts {
  /** Catalog distribution. `npx`/`uvx` never treat a same-named PATH binary as this ACP. */
  readonly distribution?: 'npx' | 'uvx' | 'binary'
}

/**
 * Find the ACP CLI for a catalog row.
 * `npx`/`uvx` rows only count `$DSH_HOME/pihuo/agents/<id>` — a PATH hit such as
 * `~/.grok/bin/grok` is a different product, not the registry package.
 * `binary` rows (and custom) use that prefix first, then PATH.
 */
export function locateWorkerCommand(
  command: string,
  workerId?: string,
  opts?: LocateWorkerOpts,
): { found: boolean; path?: string } {
  if (workerId !== undefined && workerId !== '') {
    const bin = findInstalledBin(join(resolvePihuoHome(), 'agents', safeWorkerId(workerId)), command)
    if (bin !== undefined) return { found: true, path: bin }
  }
  if (opts?.distribution === 'npx' || opts?.distribution === 'uvx') {
    return { found: false }
  }
  return probeCommand(command)
}

/**
 * Host token used in optional package names (`@openai/codex-darwin-arm64`).
 */
export function platformPackageToken(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string {
  const os = platform === 'win32' ? 'win32' : platform
  const cpu = arch === 'x64' || arch === 'x86_64' ? 'x64' : arch
  return `${os}-${cpu}`
}

function eachPackageJson(root: string, visit: (file: string) => void): void {
  const nm = join(root, 'node_modules')
  let names: string[]
  try {
    names = readdirSync(nm)
  } catch {
    return
  }
  for (const name of names) {
    if (name.startsWith('.')) continue
    if (name.startsWith('@')) {
      let scoped: string[]
      try {
        scoped = readdirSync(join(nm, name))
      } catch {
        continue
      }
      for (const child of scoped) visit(join(nm, name, child, 'package.json'))
      continue
    }
    visit(join(nm, name, 'package.json'))
  }
}

/**
 * Optional deps that match this platform and are not on disk.
 * Codex ships the native binary as `@openai/codex-darwin-arm64` etc.;
 * `npm install --prefix pkg` often records them in the lockfile and skips extract.
 */
export function missingPlatformOptionals(
  root: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string[] {
  const token = platformPackageToken(platform, arch)
  const specs: string[] = []
  const seen = new Set<string>()
  eachPackageJson(root, (file) => {
    if (!existsSync(file)) return
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(file, 'utf8')) as unknown
    } catch {
      return
    }
    if (typeof raw !== 'object' || raw === null) return
    const optional = (raw as { optionalDependencies?: unknown }).optionalDependencies
    if (typeof optional !== 'object' || optional === null || Array.isArray(optional)) return
    for (const [name, spec] of Object.entries(optional as Record<string, unknown>)) {
      if (typeof spec !== 'string' || spec === '') continue
      if (!name.includes(token)) continue
      if (existsSync(join(root, 'node_modules', ...name.split('/')))) continue
      const install = `${name}@${spec}`
      if (seen.has(install)) continue
      seen.add(install)
      specs.push(install)
    }
  })
  return specs
}

function findInstalledBin(root: string, commandName: string): string | undefined {
  const dirs = [join(root, 'node_modules', '.bin'), join(root, 'bin')]
  const names = process.platform === 'win32'
    ? [`${commandName}.cmd`, `${commandName}.exe`, commandName]
    : [commandName]
  for (const dir of dirs) {
    for (const name of names) {
      const path = join(dir, name)
      if (existsSync(path)) return path
    }
    try {
      const listed = readdirSync(dir)
      const hit = listed.find(name => name === commandName || name.startsWith(`${commandName}.`))
      if (hit !== undefined) return join(dir, hit)
    } catch {
      // try the next bin directory
    }
  }
  return undefined
}

function runLogged(
  argv: readonly string[],
  cwd: string,
  onChunk: (text: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0] ?? '', argv.slice(1), {
      cwd,
      env: {
        ...process.env,
        npm_config_loglevel: 'http',
        npm_config_progress: 'false',
        npm_config_fund: 'false',
        npm_config_audit: 'false',
        npm_config_foreground_scripts: 'true',
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(Object.assign(new Error('install timed out'), { code: 'INSTALL_TIMEOUT' }))
    }, INSTALL_TIMEOUT_MS)
    const take = (buf: Buffer): void => {
      onChunk(buf.toString('utf8'))
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code ?? 1)
    })
  })
}

/**
 * Start an install in the background. Returns the job immediately.
 */
export function startInstallJob(input: InstallRequest): InstallJob {
  if (!validatePackageSpec(input.packageSpec)) {
    const id = randomUUID()
    const job: InstallJob = {
      id,
      status: 'failed',
      log: '',
      error: 'bad package name',
    }
    jobs.set(id, job)
    return job
  }
  const id = randomUUID()
  const job: InstallJob = { id, status: 'running', log: '' }
  jobs.set(id, job)
  void runInstall(id, input)
  return job
}

async function runInstall(id: string, input: InstallRequest): Promise<void> {
  let job = jobs.get(id)
  if (job === undefined) return
  const root = join(resolvePihuoHome(), 'agents', safeWorkerId(input.workerId))
  mkdirSync(root, { recursive: true })
  const runnerName = input.distribution === 'uvx' ? 'uv' : 'npm'
  const runner = probeCommand(runnerName)
  if (!runner.found || runner.path === undefined) {
    finish(job, { status: 'failed', error: `no ${runnerName}` })
    return
  }
  const log = (text: string): void => {
    const current = jobs.get(id)
    if (current !== undefined) appendLog(current, text)
  }
  const run = async (argv: readonly string[]): Promise<number> => {
    log(`$ ${argv.join(' ')}\n`)
    return runLogged(argv, root, log)
  }
  const npmBase = [runner.path, 'install', '--prefix', root, '--no-fund', '--no-audit', '--loglevel', 'http']
  try {
    if (input.distribution === 'uvx') {
      const code = await run([runner.path, 'pip', 'install', '--prefix', root, '-v', input.packageSpec])
      if (code !== 0) {
        finish(jobs.get(id) ?? job, { status: 'failed', error: `exit ${String(code)}` })
        return
      }
    } else {
      const first = await run([...npmBase, input.packageSpec])
      if (first !== 0) {
        finish(jobs.get(id) ?? job, { status: 'failed', error: `exit ${String(first)}` })
        return
      }
      const optional = await run([...npmBase, '--include=optional'])
      if (optional !== 0) {
        log(`optional pass exit ${String(optional)}\n`)
      }
      const missing = missingPlatformOptionals(root)
      if (missing.length > 0) {
        const extra = await run([...npmBase, '--no-save', ...missing])
        if (extra !== 0) {
          finish(jobs.get(id) ?? job, { status: 'failed', error: `exit ${String(extra)}` })
          return
        }
      }
    }
    const bin = findInstalledBin(root, input.commandName)
    if (bin === undefined) {
      finish(jobs.get(id) ?? job, { status: 'failed', error: `no bin ${input.commandName}` })
      return
    }
    finish(jobs.get(id) ?? job, { status: 'ok', command: bin })
  } catch (error) {
    finish(jobs.get(id) ?? job, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
