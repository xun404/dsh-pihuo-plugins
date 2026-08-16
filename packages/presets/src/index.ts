/**
 * Host plugin: install this package's agent presets into the user roster.
 *
 * Official `dsh` last-writes `agent-presets.config.roots` to the shipped
 * root only, so a patch cannot add a system root. The writable discovery
 * path is `$DSH_HOME/.agent-presets` (`includeUserRoot`). This plugin copies
 * packaged compositions there on every apply so upgrades reach the next
 * `list()` without editing harness.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Loader display name. Matches the bundle patch `id` convention. */
export const name = 'pihuo-presets'

/** Directory name under `$DSH_HOME` that `dsh-agent-presets` scans as the user root. */
export const USER_PRESET_DIR = '.agent-presets'

/** Preset ids this package owns. Each must match `^[a-z0-9][a-z0-9-]*$`. */
export const PACKAGED_PRESET_IDS = ['pihuo-leader'] as const

/**
 * Resolve the user roster directory.
 * `DSH_HOME` wins when set; otherwise `~/.dsh`, matching the harness default.
 */
export function userPresetRoot(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.DSH_HOME?.trim()
  return join(home === undefined || home === '' ? join(homedir(), '.dsh') : home, USER_PRESET_DIR)
}

/**
 * Directory that ships the preset trees (`presets/<id>/` next to `package.json`).
 * Resolved from this module so both `src/` (tsx tests) and `lib/` work.
 */
export function packagedPresetRoot(): string {
  return join(fileURLToPath(new URL('..', import.meta.url)), 'presets')
}

/**
 * Copy one packaged preset into the user roster, overwriting our files.
 * Does not delete extra files the user added beside the composition.
 */
export function installPackagedPreset(id: string, destRoot: string, sourceRoot = packagedPresetRoot()): string {
  const from = join(sourceRoot, id)
  const to = join(destRoot, id)
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from)) {
    if (entry.startsWith('.')) continue
    copyFileSync(join(from, entry), join(to, entry))
  }
  return to
}

/**
 * Install every packaged preset under the user roster.
 * @returns the destination directory of each installed preset.
 */
export function installPackagedPresets(destRoot = userPresetRoot()): string[] {
  mkdirSync(destRoot, { recursive: true })
  return PACKAGED_PRESET_IDS.map(id => installPackagedPreset(id, destRoot))
}

/**
 * Publish packaged presets into `$DSH_HOME/.agent-presets`.
 * No services are injected: this is a boot-time file install, not a seam.
 */
export function apply(): void {
  installPackagedPresets()
}
