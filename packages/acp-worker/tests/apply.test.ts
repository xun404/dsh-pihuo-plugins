import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Config, name } from '../src/config.ts'

describe('acp-worker exports', () => {
  it('uses a stable plugin name', () => {
    assert.equal(name, 'pihuo-acp')
  })
})

describe('Config', () => {
  it('fills defaults and requires command', () => {
    const missing = Config['~standard'].validate({})
    assert.ok('issues' in missing)

    const ok = Config['~standard'].validate({ command: 'node', args: ['agent.js'] })
    assert.ok('value' in ok)
    assert.equal(ok.value.providerName, 'pihuo-acp')
    assert.equal(ok.value.disposeGraceMs, 3000)
    assert.deepEqual(ok.value.args, ['agent.js'])
  })

  it('rejects an empty cwd string', () => {
    const bad = Config['~standard'].validate({ command: 'node', cwd: '' })
    assert.ok('issues' in bad)
  })
})
