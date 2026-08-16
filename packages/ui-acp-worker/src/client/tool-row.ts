/**
 * Chat card for one `acp_worker` call.
 * Reads the call prompt and the `[acp_worker …]` result header the Host writes.
 */
import { createElement, useState, type ReactNode } from 'react'
import { DisclosureRow, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from './locales.js'
import styles from './settings.module.css'

interface ToolViewProps {
  readonly toolName: string
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

const HEADER = /^\[acp_worker id="([^"]*)" title="([^"]*)"(?: permission="[^"]*")? chat="([^"]*)" stop="([^"]*)"\](?:\n|$)/

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
  chat: string
  stop: string
  body: string
} | undefined {
  const match = HEADER.exec(text)
  if (match === null) return undefined
  return {
    id: match[1] ?? '',
    title: match[2] ?? '',
    chat: match[3] ?? '',
    stop: match[4] ?? '',
    body: text.slice(match[0].length).trim(),
  }
}

function parseArgs(raw: string | undefined): { prompt: string; label: string } {
  if (raw === undefined || raw === '') return { prompt: '', label: '' }
  try {
    const value = JSON.parse(raw) as { prompt?: unknown; label?: unknown }
    return {
      prompt: typeof value.prompt === 'string' ? value.prompt : '',
      label: typeof value.label === 'string' ? value.label : '',
    }
  } catch {
    return { prompt: raw, label: '' }
  }
}

function workerHint(prompt: string, label: string): string {
  const first = prompt.trim().split('\n')[0] ?? ''
  const hinted = /^workerId:\s*([a-z][a-z0-9_-]{0,63})\s*$/i.exec(first.trim())
  if (hinted?.[1] !== undefined) return hinted[1]
  if (label !== '') return label
  return ''
}

/**
 * Designed ACP Worker row: status, worker name, one-line summary, expandable output.
 */
export function AcpWorkerRow(props: ToolViewProps): ReactNode {
  const t = props.t ?? ((key) => key)
  const [open, setOpen] = useState(false)
  const settled = isSettled(props.block)
  const errored = settledError(props.block)
  const raw = rawText(props.block)
  const parsed = parseHeader(raw)
  const args = parseArgs(props.block.argsRaw ?? props.block.call?.argsRaw)
  const title = parsed?.title !== undefined && parsed.title !== ''
    ? parsed.title
    : workerHint(args.prompt, args.label) || t('cardTitle')
  const state = errored ? 'error' : settled ? 'done' : 'ongoing'
  const status = errored ? t('cardError') : settled ? t('cardOk') : t('cardRunning')
  const body = parsed?.body ?? raw
  const summary = !settled
    ? status
    : body === ''
      ? status
      : body.split('\n')[0] ?? status
  const meta = parsed === undefined
    ? null
    : createElement(
      'div',
      { className: styles.cardMeta },
      `${parsed.id} · ${parsed.chat}`,
    )
  return createElement(
    'div',
    {
      'data-acp-worker': props.toolName,
      'data-acp-worker-state': errored ? 'error' : settled ? 'ok' : 'running',
      'data-acp-worker-id': parsed?.id ?? '',
      className: styles.card,
    },
    createElement(
      DisclosureRow,
      {
        icon: createElement(StateDot, { state, size: 10 }),
        title,
        open,
        expandable: settled && body !== '',
        expandOnRowClick: true,
        keepContentWhenOpen: true,
        onToggle: () => { setOpen(current => !current) },
        collapsedContent: createElement('span', { className: styles.cardSummary }, summary),
      },
      createElement(
        'div',
        { className: styles.cardBody },
        meta,
        createElement('pre', { className: styles.cardOutput }, body),
      ),
    ),
  )
}
