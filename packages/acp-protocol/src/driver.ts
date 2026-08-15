import { Readable, Writable } from 'node:stream'
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ClientApp,
  type ClientContext,
} from '@agentclientprotocol/sdk'
import type { WorkerPermissionPolicy, WorkerPromptResult } from '@pihuo/dsh-worker-protocol'
import { pickAutoPermission } from './permission.js'
import { acpStopReason } from './stop-reason.js'

/**
 * Transport and auto-permission policy for one child ACP process.
 * `ask` is not handled here (phase 2 / `ctx.approval`). The caller owns spawn.
 */
export interface AcpDriverOptions {
  readonly cwd: string
  readonly permission: Exclude<WorkerPermissionPolicy, 'ask'>
  readonly stdin: Writable
  readonly stdout: Readable
}

export class AcpProtocolError extends Error {
  constructor(message: string, readonly code: 'protocol_incompatible' | 'no_session' | 'cancelled') {
    super(message)
    this.name = 'AcpProtocolError'
  }
}

/**
 * ACP 1.2 client over a child's stdio.
 * Owns initialize + session/new + prompt + cancel. Does not spawn or kill
 * the process — the caller owns the `SubprocessHandle`.
 */
export class AcpSessionDriver {
  private agent!: ClientContext
  private sessionId: string | null = null
  private output = ''

  private constructor(private readonly opts: AcpDriverOptions) {}

  /**
   * Handshake `initialize` on the given stdio pair.
   * @throws {AcpProtocolError} `protocol_incompatible` when versions differ.
   */
  static async connect(opts: AcpDriverOptions): Promise<AcpSessionDriver> {
    const drv = new AcpSessionDriver(opts)
    const app: ClientApp = client({ name: 'pihuo-acp' })
    app
      .onRequest(methods.client.session.requestPermission, async (ctx) => {
        const params = ctx.params as { options?: Array<{ optionId: string; kind?: string }> }
        const picked = pickAutoPermission(opts.permission, params.options ?? [])
        if (picked.outcome === 'cancelled') return { outcome: { outcome: 'cancelled' as const } }
        return { outcome: { outcome: 'selected' as const, optionId: picked.optionId } }
      })
      .onNotification(methods.client.session.update, (ctx) => {
        const update = (ctx.params as { update?: { sessionUpdate?: string; content?: { type?: string; text?: unknown } } }).update
        if (update?.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
          drv.output += String(update.content.text ?? '')
        }
      })
    const stream = ndJsonStream(
      Writable.toWeb(opts.stdin) as WritableStream<Uint8Array>,
      Readable.toWeb(opts.stdout) as ReadableStream<Uint8Array>,
    )
    drv.agent = app.connect(stream).agent
    const init = await drv.agent.request(methods.agent.initialize, {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
      },
    })
    if (init.protocolVersion !== PROTOCOL_VERSION) {
      throw new AcpProtocolError(
        `ACP protocol version incompatible (agent=${String(init.protocolVersion)}, client=${PROTOCOL_VERSION})`,
        'protocol_incompatible',
      )
    }
    return drv
  }

  /** Create one ACP session. `mcpServers` is always empty. */
  async sessionNew(): Promise<string> {
    const response = await this.agent.request(methods.agent.session.new, {
      cwd: this.opts.cwd,
      mcpServers: [],
    })
    this.sessionId = response.sessionId
    return response.sessionId
  }

  /**
   * Send one text prompt and collect `agent_message_chunk` text.
   * Aborting `signal` notifies `session/cancel` and maps to `stopReason: aborted`.
   * Does not kill the OS process — the caller owns {@link SubprocessHandle}.
   * @returns `ok: true` only for ACP `end_turn`. Unknown stop reasons are `error`.
   */
  async prompt(text: string, signal?: AbortSignal): Promise<WorkerPromptResult> {
    if (this.sessionId === null) throw new AcpProtocolError('No active session', 'no_session')
    if (signal?.aborted) {
      return { ok: false, output: this.output, stopReason: 'aborted', error: 'Cancelled' }
    }
    this.output = ''
    const sessionId = this.sessionId
    const onAbort = () => {
      void this.agent.notify(methods.agent.session.cancel, { sessionId }).catch(() => {})
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const response = await this.agent.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: 'text', text }],
      })
      const stopReason = acpStopReason(String(response.stopReason ?? ''))
      if (stopReason === 'completed') {
        return { ok: true, output: this.output, stopReason }
      }
      return { ok: false, output: this.output, stopReason, error: stopReason }
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  }

  /** Best-effort `session/cancel`. Safe when no session exists yet. */
  async cancel(): Promise<void> {
    if (this.sessionId === null) return
    await this.agent.notify(methods.agent.session.cancel, { sessionId: this.sessionId }).catch(() => {})
  }
}
