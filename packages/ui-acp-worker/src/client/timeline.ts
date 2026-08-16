/**
 * Collapse consecutive thought/message chunks and fold tool updates onto
 * the same toolCallId, preserving arrival order.
 */

export interface TimelineActivity {
  readonly kind: 'message' | 'thought' | 'tool' | 'plan'
  readonly text: string
  readonly toolCallId?: string
  readonly toolTitle?: string
  readonly toolStatus?: string
}

export function coalesceTimeline(activities: readonly TimelineActivity[]): TimelineActivity[] {
  const items: TimelineActivity[] = []
  for (const row of activities) {
    const last = items[items.length - 1]
    if (last !== undefined && last.kind === 'thought' && row.kind === 'thought') {
      items[items.length - 1] = { ...last, text: last.text + row.text }
      continue
    }
    if (last !== undefined && last.kind === 'message' && row.kind === 'message') {
      items[items.length - 1] = { ...last, text: last.text + row.text }
      continue
    }
    if (row.kind === 'tool' && row.toolCallId !== undefined && row.toolCallId !== '') {
      const index = items.findIndex(item => item.kind === 'tool' && item.toolCallId === row.toolCallId)
      if (index >= 0) {
        items[index] = row
        continue
      }
    }
    items.push(row)
  }
  return items
}
