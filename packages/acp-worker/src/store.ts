/**
 * `$DSH_HOME/pihuo/workers.json` roster on top of the plugin's patch Config.
 * Version 1 files upgrade to one `default` row. Secrets stay out of this file.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  decodeWorkerUserFile,
  encodeWorkerUserFile,
  mergeWorkerConfig,
  parseWorkerRoster,
  WORKER_ID_DEFAULT,
  type WorkerRosterEntry,
  type WorkerUserConfig,
} from '@pihuo/dsh-worker-protocol'
import type { Config as PluginConfig } from './config.js'

/** Loaded roster plus the pool generation. */
export interface EffectiveRoster {
  readonly revision: number
  readonly workers: readonly WorkerRosterEntry[]
  readonly lastError?: string
}

/**
 * Directory that holds `workers.json`.
 * `$DSH_HOME/pihuo` when `DSH_HOME` is set; otherwise `~/.dsh/pihuo`.
 */
export function resolvePihuoHome(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.DSH_HOME?.trim()
  return join(home === undefined || home === '' ? join(homedir(), '.dsh') : home, 'pihuo')
}

/** Absolute path of the user overlay document. */
export function workersFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolvePihuoHome(env), 'workers.json')
}

/**
 * Map loader Config into the user-config subset used as the missing-file row.
 * Plugin `env` is not copied — secrets stay out of the file and the HTTP DTO.
 */
export function defaultsFromPlugin(config: PluginConfig): Partial<WorkerUserConfig> {
  return {
    command: config.command,
    args: config.args,
  }
}

function fallbackConfig(plugin: PluginConfig): WorkerUserConfig {
  const merged = mergeWorkerConfig(defaultsFromPlugin(plugin), {})
  if ('value' in merged) return merged.value
  return {
    enabled: true,
    command: plugin.command,
    args: plugin.args,
    idleTtlMs: 300_000,
    poolMax: 4,
  }
}

/**
 * One `default` row from plugin Config when the file is missing or unreadable.
 * `trusted` is true only when the command is spawnable (not bare `node`).
 */
export function defaultRoster(plugin: PluginConfig): WorkerRosterEntry[] {
  const config = fallbackConfig(plugin)
  const usable = !(config.command === 'node' && config.args.length === 0)
  return [{
    ...config,
    id: WORKER_ID_DEFAULT,
    title: 'Default',
    trusted: usable,
  }]
}

/**
 * Plugin defaults or the on-disk roster.
 * Missing file is not an error. Corrupt JSON returns {@link defaultRoster}
 * plus `lastError`; callers must not spawn from a document they cannot parse.
 */
export function readRoster(plugin: PluginConfig, env: NodeJS.ProcessEnv = process.env): EffectiveRoster {
  const path = workersFilePath(env)
  try {
    const decoded = decodeWorkerUserFile(readFileSync(path, 'utf8'))
    if ('issues' in decoded) {
      return { revision: 0, workers: defaultRoster(plugin), lastError: decoded.issues.join('; ') }
    }
    return { revision: decoded.value.revision, workers: decoded.value.workers }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { revision: 0, workers: defaultRoster(plugin) }
    }
    return {
      revision: 0,
      workers: defaultRoster(plugin),
      lastError: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Persist a roster and increment `revision` (pool key generation).
 * Does not write secrets. Rejects duplicate or illegal ids.
 */
export function writeRoster(
  plugin: PluginConfig,
  next: unknown,
  env: NodeJS.ProcessEnv = process.env,
): EffectiveRoster {
  const current = readRoster(plugin, env)
  const parsed = parseWorkerRoster(next)
  if ('issues' in parsed) {
    return { ...current, lastError: parsed.issues.join('; ') }
  }
  const revision = current.revision + 1
  const path = workersFilePath(env)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, encodeWorkerUserFile(parsed.value, revision))
  return { revision, workers: parsed.value }
}
