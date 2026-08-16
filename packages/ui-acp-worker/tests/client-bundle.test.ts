import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const bundle = fileURLToPath(new URL('../lib/client.js', import.meta.url))

describe('ui-acp-worker client factory bundle', () => {
  it('registers through __ModuleLoader__ under the package name', () => {
    const src = readFileSync(bundle, 'utf8')
    assert.match(src, /window\.__ModuleLoader__\.load\(\{/)
    assert.match(src, /id:\s*"@pihuo\/dsh-pihuo-acp-ui"/)
    assert.match(src, /factory:\s*\(require\)\s*=>/)
    assert.doesNotMatch(src, /^import /m)
    assert.match(src, /require\("react"\)/)
    assert.match(src, /require\("@deepseek-ai\/dsh-client-ui-primitives"\)/)
    assert.match(src, /data-pihuo-workers/)
    assert.match(src, /data-acp-worker-dock/)
    assert.match(src, /phw_page/)
  })
})
