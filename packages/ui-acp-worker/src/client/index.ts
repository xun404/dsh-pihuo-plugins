/**
 * Browser half of `@pihuo/dsh-ui-acp-worker`.
 *
 * Registers a keyed `tool.call.toolview` for wire name `acp_worker`. Must ship
 * as the CJS factory at `exports["./client"]` (`lib/client.js`); tsc's
 * `lib/client/index.js` is types-only and is not what the host serves.
 */
import { createElement, type ReactNode } from 'react'

/** Cordis service this apply reads. Must match the live client `slots` face. */
export const inject = ['slots']

/**
 * Owner props the `tool.call.toolview` seat passes in.
 * Running calls have no `kind`; a settled result is `{ kind: 'tool-result', … }`.
 */
interface ToolViewProps {
  readonly toolName: string
  readonly block: {
    readonly kind?: string
    readonly status?: string
    readonly isError?: boolean
    readonly result?: { readonly isError?: boolean }
    readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }>
  }
}

function isSettled(block: ToolViewProps['block']): boolean {
  return block.kind === 'tool-result'
}

function settledError(block: ToolViewProps['block']): boolean {
  return block.isError === true || block.result?.isError === true
}

function previewText(block: ToolViewProps['block']): string {
  const chunks = block.content
    ?.filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('')
    .trim()
  if (chunks === undefined || chunks === '') return ''
  return chunks.length > 160 ? `${chunks.slice(0, 157)}…` : chunks
}

/**
 * One-line ACP Worker row. Replaces the generic tool card for `acp_worker`.
 * Product copy is Chinese; this component must not import another plugin's UI.
 */
function AcpWorkerRow(props: ToolViewProps): ReactNode {
  const settled = isSettled(props.block)
  const errored = settledError(props.block)
  const label = errored ? 'ACP Worker 失败' : settled ? 'ACP Worker 完成' : 'ACP Worker 运行中'
  const preview = previewText(props.block)
  return createElement(
    'div',
    { 'data-acp-worker': props.toolName, 'data-acp-worker-state': errored ? 'error' : settled ? 'ok' : 'running' },
    preview === '' ? label : `${label} · ${preview}`,
  )
}

/** Minimal slots face this plugin touches. Components never see `ctx`. */
interface ClientCtx {
  slots: {
    inject(name: string, factory: () => unknown): unknown
    register(spec: { name: string; key: string }, component: unknown): unknown
  }
  effect(factory: () => unknown, label?: string): unknown
}

/**
 * Register the `acp_worker` tool row.
 * The Host loader row for this package must stay live or `client-modules`
 * drops `./client` from `__DSH_BOOT__.entries` and the generic card is used.
 */
export function apply(ctx: ClientCtx): void {
  ctx.effect(
    () => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
      { name: 'tool.call.toolview', key: 'acp_worker' },
      AcpWorkerRow,
    )),
    'ui-acp-worker: toolview',
  )
}
