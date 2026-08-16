import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chatPresetToWorkerPolicy, parentChatPreset } from '../src/inherit.ts'

describe('chatPresetToWorkerPolicy', () => {
  it('maps the three chat presets', () => {
    assert.equal(chatPresetToWorkerPolicy('read-only'), 'reject')
    assert.equal(chatPresetToWorkerPolicy('workspace-write'), 'ask')
    assert.equal(chatPresetToWorkerPolicy('danger-full-access'), 'allow')
    assert.equal(chatPresetToWorkerPolicy(undefined), 'ask')
  })
})

describe('parentChatPreset', () => {
  it('reads the last permission/preset event', () => {
    assert.equal(parentChatPreset(undefined), undefined)
    assert.equal(parentChatPreset([
      { type: 'permission/preset', data: { preset: 'read-only' } },
      { type: 'permission/preset', data: { preset: 'danger-full-access' } },
    ]), 'danger-full-access')
  })
})
