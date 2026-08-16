import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { coalesceTimeline } from '../src/client/timeline.ts'

describe('coalesceTimeline', () => {
  it('merges consecutive thought and message chunks', () => {
    const items = coalesceTimeline([
      { kind: 'thought', text: 'hmm' },
      { kind: 'thought', text: '…' },
      { kind: 'tool', text: 'read', toolCallId: 't1', toolTitle: 'read', toolStatus: 'in_progress' },
      { kind: 'tool', text: 'read', toolCallId: 't1', toolTitle: 'read', toolStatus: 'completed' },
      { kind: 'message', text: 'hi' },
      { kind: 'message', text: ' there' },
    ])
    assert.equal(items.length, 3)
    assert.equal(items[0]?.text, 'hmm…')
    assert.equal(items[1]?.toolStatus, 'completed')
    assert.equal(items[2]?.text, 'hi there')
  })

  it('keeps thought after a tool as a new beat', () => {
    const items = coalesceTimeline([
      { kind: 'thought', text: 'a' },
      { kind: 'tool', text: 'read', toolCallId: 't1', toolTitle: 'read' },
      { kind: 'thought', text: 'b' },
    ])
    assert.equal(items.length, 3)
    assert.equal(items[0]?.text, 'a')
    assert.equal(items[2]?.text, 'b')
  })
})
