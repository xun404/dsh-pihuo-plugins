/**
 * Read a package spec out of npx/uvx argv and turn it into a local binary name.
 * Catalog rows store that binary, not `npx -y …`.
 */

/** First package token in npx/uvx argv (`-y pkg`, `--package pkg`, or first non-flag). */
export function packageSpecFromArgs(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]
    if (token === undefined) continue
    if (token === '-p' || token === '--package') {
      const next = args[i + 1]
      return next !== undefined && next !== '' ? next : undefined
    }
    if (token.startsWith('-')) continue
    return token
  }
  return undefined
}

/**
 * Bare command name from an npm or uv spec.
 * `@scope/name@1.2.3` → `name`. `fast-agent-acp==0.10.1` → `fast-agent-acp`.
 */
export function binaryNameFromPackageSpec(spec: string): string | undefined {
  const trimmed = spec.trim()
  if (trimmed === '') return undefined
  const withoutNpmVersion = trimmed.replace(/@[^@/]+$/, '')
  const withoutUvVersion = withoutNpmVersion.replace(/==.+$/, '')
  const name = withoutUvVersion.includes('/')
    ? withoutUvVersion.slice(withoutUvVersion.lastIndexOf('/') + 1)
    : withoutUvVersion
  return name === '' ? undefined : name
}
