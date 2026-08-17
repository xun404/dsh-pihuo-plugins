import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { parseReleaseVersion, setWorkspaceVersions } from './set-release-version.mjs'

describe('parseReleaseVersion', () => {
  it('accepts a plain semver and a v-prefixed tag', () => {
    assert.equal(parseReleaseVersion('0.1.0'), '0.1.0')
    assert.equal(parseReleaseVersion('v1.2.3'), '1.2.3')
    assert.equal(parseReleaseVersion('v0.1.0-rc.1'), '0.1.0-rc.1')
  })

  it('rejects build metadata and junk', () => {
    assert.throws(() => parseReleaseVersion('1.0.0+build'), /not a publishable semver/)
    assert.throws(() => parseReleaseVersion('v'), /not a publishable semver/)
    assert.throws(() => parseReleaseVersion('latest'), /not a publishable semver/)
  })
})

describe('setWorkspaceVersions', () => {
  it('writes version onto public packages and skips private ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pihuo-release-'))
    mkdirSync(join(dir, 'keep'))
    mkdirSync(join(dir, 'skip'))
    writeFileSync(join(dir, 'keep', 'package.json'), JSON.stringify({
      name: '@pihuo/keep',
      version: '0.0.1',
    }))
    writeFileSync(join(dir, 'skip', 'package.json'), JSON.stringify({
      name: '@pihuo/skip',
      version: '0.0.1',
      private: true,
    }))
    const names = setWorkspaceVersions('2.0.0', dir)
    assert.deepEqual(names, ['@pihuo/keep'])
    assert.equal(JSON.parse(readFileSync(join(dir, 'keep', 'package.json'), 'utf8')).version, '2.0.0')
    assert.equal(JSON.parse(readFileSync(join(dir, 'skip', 'package.json'), 'utf8')).version, '0.0.1')
  })
})
