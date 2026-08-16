import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractReasoningSelector, pickLiveReasoning } from '../src/reasoning.ts'

describe('extractReasoningSelector', () => {
  it('returns undefined when nothing is declared', () => {
    assert.equal(extractReasoningSelector(undefined), undefined)
    assert.equal(extractReasoningSelector([]), undefined)
  })

  it('prefers category thought_level over a known id', () => {
    const selector = extractReasoningSelector([
      {
        id: 'reasoning_effort',
        type: 'select',
        currentValue: 'low',
        options: [{ value: 'low', name: 'Low' }, { value: 'high', name: 'High' }],
      },
      {
        id: 'effort',
        category: 'thought_level',
        type: 'select',
        currentValue: 'high',
        options: [{ value: 'low', name: 'Low' }, { value: 'high', name: 'High' }],
      },
    ])
    assert.equal(selector?.configId, 'effort')
    assert.equal(selector?.currentValue, 'high')
  })

  it('falls back to reasoning_effort without a category', () => {
    const selector = extractReasoningSelector([
      {
        id: 'reasoning_effort',
        type: 'select',
        currentValue: 'medium',
        options: [{ value: 'low', name: 'Low' }, { value: 'medium', name: 'Medium' }],
      },
    ])
    assert.equal(selector?.configId, 'reasoning_effort')
    assert.deepEqual(selector?.options.map(row => row.value), ['low', 'medium'])
  })

  it('flattens grouped options', () => {
    const selector = extractReasoningSelector([
      {
        id: 'effort',
        category: 'thought_level',
        type: 'select',
        options: [
          { group: 'basic', options: [{ value: 'low', name: 'Low' }, { value: 'high', name: 'High' }] },
        ],
      },
    ])
    assert.deepEqual(selector?.options.map(row => row.value), ['low', 'high'])
  })
})

describe('pickLiveReasoning', () => {
  it('uses currentValue when it is a live option', () => {
    assert.equal(pickLiveReasoning({
      configId: 'effort',
      currentValue: 'low',
      options: [
        { value: 'low', name: 'Low' },
        { value: 'max', name: 'Max' },
      ],
    }), 'low')
  })

  it('ignores a currentValue the select does not declare', () => {
    assert.equal(pickLiveReasoning({
      configId: 'effort',
      currentValue: 'max',
      options: [{ value: 'low', name: 'Low' }],
    }), '')
  })
})
