/**
 * Chat card for one `acp_worker` call.
 * Title is `name · model · thinking`. Body is the ACP session timeline
 * (thought / tool / message in arrival order). Live samples come from
 * `/pihuo/workers/live`; replay reads the result trailer.
 */
import { createElement, useEffect, useState, type ReactNode } from 'react'
import { DisclosureRow } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from './locales.js'
import styles from './settings.module.css'
import { coalesceTimeline, type TimelineActivity } from './timeline.js'

interface ToolViewProps {
  readonly toolName: string
  readonly sessionId?: string
  readonly block: {
    readonly kind?: string
    readonly isError?: boolean
    readonly argsRaw?: string
    readonly call?: { readonly argsRaw?: string }
    readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }>
    readonly result?: { readonly isError?: boolean }
  }
  readonly t?: Translate
}

type Activity = TimelineActivity

interface LiveRun {
  readonly id: string
  readonly workerId: string
  readonly title: string
  readonly model?: string
  readonly thinking?: string
  readonly settled?: boolean
  readonly activities: readonly Activity[]
}

const HEADER = /^\[acp_worker id="([^"]*)" title="([^"]*)"(?: model="([^"]*)")?(?: thinking="([^"]*)")?(?: permission="[^"]*")? chat="([^"]*)" stop="([^"]*)"\](?:\n|$)/
const TRAILER = /\n\n<!--pihuo-activity\n([\s\S]*?)\n-->\s*$/

function isSettled(block: ToolViewProps['block']): boolean {
  return block.kind === 'tool-result'
}

function settledError(block: ToolViewProps['block']): boolean {
  return block.isError === true || block.result?.isError === true
}

function rawText(block: ToolViewProps['block']): string {
  return (block.content ?? [])
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('')
    .trim()
}

function parseHeader(text: string): {
  id: string
  title: string
  model: string
  thinking: string
  chat: string
  stop: string
  body: string
} | undefined {
  const match = HEADER.exec(text)
  if (match === null) return undefined
  return {
    id: match[1] ?? '',
    title: match[2] ?? '',
    model: match[3] ?? '',
    thinking: match[4] ?? '',
    chat: match[5] ?? '',
    stop: match[6] ?? '',
    body: text.slice(match[0].length).trim(),
  }
}

function parseTrailer(text: string): { body: string; activities: Activity[] } {
  const match = TRAILER.exec(text)
  if (match === null) return { body: text, activities: [] }
  let activities: Activity[] = []
  try {
    const parsed = JSON.parse(match[1] ?? '[]') as unknown
    if (Array.isArray(parsed)) {
      activities = parsed.filter((row): row is Activity => (
        typeof row === 'object' && row !== null && typeof (row as { kind?: unknown }).kind === 'string'
      ))
    }
  } catch {
    activities = []
  }
  return { body: text.slice(0, match.index).trim(), activities }
}

function parseArgs(raw: string | undefined): { prompt: string; label: string } {
  if (raw === undefined || raw === '') return { prompt: '', label: '' }
  try {
    const value = JSON.parse(raw) as { prompt?: unknown; description?: unknown; label?: unknown }
    return {
      prompt: typeof value.prompt === 'string' ? value.prompt : '',
      label: typeof value.description === 'string'
        ? value.description
        : typeof value.label === 'string' ? value.label : '',
    }
  } catch {
    return { prompt: raw, label: '' }
  }
}

function workerHint(prompt: string): string {
  for (const line of prompt.trim().split('\n').slice(0, 8)) {
    const hinted = /^workerId:\s*([a-z][a-z0-9_-]{0,63})\s*$/i.exec(line.trim())
    if (hinted?.[1] !== undefined) return hinted[1]
  }
  return ''
}

function pickLiveRun(runs: readonly LiveRun[], hinted: string): LiveRun | undefined {
  const open = runs.filter(run => run.settled !== true)
  if (hinted !== '') {
    for (let index = open.length - 1; index >= 0; index -= 1) {
      const run = open[index]
      if (run?.workerId === hinted) return run
    }
  }
  return open[open.length - 1]
}

function cardTitle(name: string, model: string, thinking: string, fallback: string): string {
  const parts = [name === '' ? fallback : name]
  parts.push(model === '' ? '—' : model)
  parts.push(thinking === '' ? '—' : thinking)
  return parts.join(' · ')
}

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length > 80 ? `${line.slice(0, 80)}…` : line
}

function summaryFrom(items: readonly Activity[], errored: boolean, settled: boolean, t: Translate): string {
  if (errored) return t('cardError')
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const row = items[index]
    if (row === undefined) continue
    if (row.kind === 'tool') return row.toolTitle ?? firstLine(row.text)
    if (row.text.trim() !== '') return firstLine(row.text)
  }
  return settled ? t('cardOk') : t('cardRunning')
}

function letterIcon(name: string): ReactNode {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  return createElement('span', { className: styles.cardIcon, 'aria-hidden': true }, letter)
}

function kindLabel(kind: Activity['kind'], t: Translate): string {
  if (kind === 'thought') return t('cardThink')
  if (kind === 'tool') return t('cardTools')
  if (kind === 'plan') return t('cardPlan')
  return t('cardAnswer')
}

/**
 * Designed ACP Worker row: name · model · thinking, plus an ordered timeline.
 */
export function AcpWorkerRow(props: ToolViewProps): ReactNode {
  const t = props.t ?? ((key) => key)
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState<LiveRun | undefined>(undefined)
  const settled = isSettled(props.block)
  const errored = settledError(props.block)
  const raw = rawText(props.block)
  const parsed = parseHeader(raw)
  const trailed = parseTrailer(parsed?.body ?? raw)
  const args = parseArgs(props.block.argsRaw ?? props.block.call?.argsRaw)
  const hinted = workerHint(args.prompt)

  useEffect(() => {
    if (settled || props.sessionId === undefined || props.sessionId === '') return
    let cancelled = false
    const tick = (): void => {
      void fetch(`/pihuo/workers/live?parent=${encodeURIComponent(props.sessionId ?? '')}`)
        .then(res => res.json() as Promise<{ runs?: LiveRun[] }>)
        .then((body) => {
          if (cancelled) return
          setLive(pickLiveRun(body.runs ?? [], hinted))
        }, () => {})
    }
    tick()
    const timer = setInterval(tick, 400)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [settled, props.sessionId, hinted])

  const name = parsed?.title !== undefined && parsed.title !== ''
    ? parsed.title
    : (live?.title ?? (hinted === '' ? t('cardTitle') : hinted))
  const model = parsed?.model || live?.model || ''
  const thinking = parsed?.thinking || live?.thinking || ''
  const title = cardTitle(name, model, thinking, t('cardTitle'))
  const rawActivities = settled ? trailed.activities : (live?.activities ?? [])
  const items = coalesceTimeline(
    rawActivities.length > 0
      ? rawActivities
      : (settled && trailed.body !== '' ? [{ kind: 'message', text: trailed.body }] : []),
  )
  const summary = summaryFrom(items, errored, settled, t)
  const hasBody = items.length > 0

  return createElement(
    'div',
    {
      'data-acp-worker': props.toolName,
      'data-acp-worker-state': errored ? 'error' : settled ? 'ok' : 'running',
      'data-acp-worker-id': parsed?.id ?? live?.workerId ?? '',
      className: styles.card,
    },
    createElement(
      DisclosureRow,
      {
        icon: letterIcon(name),
        title,
        open,
        expandable: hasBody,
        expandOnRowClick: true,
        keepContentWhenOpen: true,
        onToggle: () => { setOpen(current => !current) },
        collapsedContent: createElement(
          'span',
          { className: styles.cardCollapsed },
          createElement('span', { className: styles.cardSep, 'aria-hidden': true }),
          createElement('span', { className: styles.cardSummary }, summary),
        ),
      },
      createElement(
        'div',
        { className: styles.cardBody },
        items.map((row, index) => createElement(
          'section',
          {
            key: `${row.kind}-${row.toolCallId ?? String(index)}`,
            className: styles.cardSection,
            'data-acp-section': row.kind,
          },
          createElement('div', { className: styles.cardSectionLabel }, kindLabel(row.kind, t)),
          row.kind === 'tool'
            ? createElement(
              'div',
              { className: styles.cardTool },
              createElement('span', { className: styles.cardToolTitle }, row.toolTitle ?? row.text),
              row.toolStatus === undefined || row.toolStatus === ''
                ? null
                : createElement('span', { className: styles.cardToolStatus }, row.toolStatus),
            )
            : createElement(
              'pre',
              { className: row.kind === 'thought' ? styles.cardThink : styles.cardOutput },
              row.text,
            ),
        )),
      ),
    ),
  )
}
