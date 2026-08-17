#!/usr/bin/env node
/**
 * Write the same semver onto every workspace package under packages/.
 * The private repo root is left unchanged.
 *
 * Used by the tag-triggered publish workflow so `git tag vX.Y.Z` is
 * the published version, without a separate bump commit.
 *
 * Usage:
 *   node scripts/set-release-version.mjs 0.1.1
 *   node scripts/set-release-version.mjs --from-tag v0.1.1
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const packagesDir = join(root, 'packages')

/** Semver with optional prerelease; build metadata is rejected. */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/

/**
 * Parse a CLI version or a git tag (`v1.2.3` / `1.2.3`).
 * @param {string} raw
 * @returns {string}
 */
export function parseReleaseVersion(raw) {
  const trimmed = raw.trim()
  const version = trimmed.startsWith('v') ? trimmed.slice(1) : trimmed
  if (!SEMVER.test(version)) {
    throw new Error(`not a publishable semver: ${JSON.stringify(raw)}`)
  }
  return version
}

/**
 * @param {string} version
 * @param {string} [dir]
 * @returns {string[]} package names that were updated
 */
export function setWorkspaceVersions(version, dir = packagesDir) {
  const names = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const manifestPath = join(dir, entry.name, 'package.json')
    let manifest
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      continue
    }
    if (manifest.private === true) continue
    if (typeof manifest.name !== 'string' || manifest.name === '') continue
    manifest.version = version
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    names.push(manifest.name)
  }
  if (names.length === 0) {
    throw new Error(`no publishable packages under ${dir}`)
  }
  return names
}

function main(argv) {
  const fromTag = argv[0] === '--from-tag'
  const raw = fromTag ? argv[1] : argv[0]
  if (raw === undefined || raw === '') {
    throw new Error('usage: set-release-version.mjs <version> | --from-tag <tag>')
  }
  const version = parseReleaseVersion(raw)
  const names = setWorkspaceVersions(version)
  process.stdout.write(`${JSON.stringify({ version, packages: names }, null, 2)}\n`)
}

const invoked = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1]
if (invoked) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}
