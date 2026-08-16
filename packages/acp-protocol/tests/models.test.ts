import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractModelOptions } from '../src/models.ts'

describe('extractModelOptions', () => {
  it('reads a flat model select', () => {
    const result = extractModelOptions([
      {
        id: 'model',
        category: 'model',
        type: 'select',
        currentValue: 'flash',
        options: [
          { value: 'flash', name: 'Flash' },
          { value: 'pro', name: 'Pro' },
        ],
      },
    ])
    assert.equal(result.ok, true)
    assert.equal(result.modelConfigId, 'model')
    assert.equal(result.currentModelId, 'flash')
    assert.deepEqual(result.models.map(row => row.modelId), ['flash', 'pro'])
  })

  it('reads grouped options', () => {
    const result = extractModelOptions([
      {
        id: 'model',
        type: 'select',
        options: [
          { group: 'zen', options: [{ value: 'opencode/big-pickle', name: 'Big Pickle' }] },
        ],
      },
    ])
    assert.equal(result.ok, true)
    assert.equal(result.models[0]?.modelId, 'opencode/big-pickle')
  })

  it('fails closed when the agent lists no configOptions', () => {
    const result = extractModelOptions([])
    assert.equal(result.ok, false)
    assert.equal(result.errorCode, 'ACP_MODELS_NOT_DECLARED')
  })
})
