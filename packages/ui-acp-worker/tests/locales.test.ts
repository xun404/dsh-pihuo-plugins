import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/locales.ts'

describe('pihuo.workers dictionaries', () => {
  it('keep the same keys in en and zh', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
  })

  it('has no empty strings', () => {
    for (const [key, value] of [...Object.entries(en), ...Object.entries(zh)]) {
      assert.notEqual(value.trim(), '', key)
    }
  })

  it('uses short model and thinking labels', () => {
    assert.equal(zh.fieldModel, '模型')
    assert.equal(zh.fieldReasoning, '思考')
    assert.equal(en.fieldModel, 'Model')
    assert.equal(en.fieldReasoning, 'Thinking')
  })
})
