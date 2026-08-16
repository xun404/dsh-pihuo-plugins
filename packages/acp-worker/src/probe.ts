/**
 * Resolve an executable on PATH without running it.
 * Used by POST /pihuo/workers/probe so the settings page can show whether
 * a catalog command exists. Never `npx`, never spawn the ACP child.
 */
import { accessSync, constants } from 'node:fs'
import { delimiter, isAbsolute, join } from 'node:path'

export interface ProbeResult {
  readonly found: boolean
  readonly path?: string
}

/**
 * Locate `command` on `PATH` (or accept an absolute file).
 * Windows also tries PATHEXT suffixes. Does not execute the file.
 */
export function probeCommand(command: string, env: NodeJS.ProcessEnv = process.env): ProbeResult {
  const trimmed = command.trim()
  if (trimmed === '') return { found: false }
  if (isAbsolute(trimmed)) {
    try {
      accessSync(trimmed, constants.X_OK)
      return { found: true, path: trimmed }
    } catch {
      return { found: false }
    }
  }
  const dirs = (env.PATH ?? '').split(delimiter).filter(dir => dir !== '')
  const suffixes = process.platform === 'win32'
    ? ['', ...(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').filter(ext => ext !== '')]
    : ['']
  for (const dir of dirs) {
    for (const suffix of suffixes) {
      const file = join(dir, `${trimmed}${suffix}`)
      try {
        accessSync(file, constants.X_OK)
        return { found: true, path: file }
      } catch {
        // try the next suffix / directory
      }
    }
  }
  return { found: false }
}
