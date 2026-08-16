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
import { extractModelOptions, type ModelOptionsResult } from './models.js'
import { pickAutoPermission } from './permission.js'
import { acpStopReason } from './stop-reason.js'

export type PermissionDecision =
  | { readonly outcome: 'selected'; readonly optionId: string }
  | { readonly outcome: 'cancelled' }

/**
 * Transport and permission policy for one child ACP process.
 * `ask` requires {@link AcpDriverOptions.askPermission}; without it, asks cancel.
 * The caller owns spawn and process lifetime.
 */
export interface AcpDriverOptions {
  readonly cwd: string
  readonly permission: WorkerPermissionPolicy
  readonly stdin: Writable
  readonly stdout: Readable
  /**
   * Called when `permission` is `ask`. Must not throw; return `cancelled` to
   * refuse the child. Used to bridge `ctx.approval`.
   */
  readonly askPermission?: (options: ReadonlyArray<{ optionId: string; kind?: string }>) => Promise<PermissionDecision>
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
export interface AcpAgentInfo {
  readonly protocolVersion: number
  readonly agentName?: string
  readonly agentVersion?: string
}

export class AcpSessionDriver {
  private agent!: ClientContext
  private sessionId: string | null = null
  private output = ''
  private info: AcpAgentInfo | undefined

  private constructor(private readonly opts: AcpDriverOptions) {}

  /** Identity advertised by `initialize`, when the handshake finished. */
  get agentInfo(): AcpAgentInfo | undefined {
    return this.info
  }

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
        const options = params.options ?? []
        const picked = opts.permission === 'ask'
          ? await (opts.askPermission?.(options) ?? Promise.resolve({ outcome: 'cancelled' as const }))
          : pickAutoPermission(opts.permission, options)
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
    const agentName = typeof init.agentInfo?.name === 'string' && init.agentInfo.name !== ''
      ? init.agentInfo.name
      : undefined
    const agentVersion = typeof init.agentInfo?.version === 'string' && init.agentInfo.version !== ''
      ? init.agentInfo.version
      : undefined
    drv.info = {
      protocolVersion: init.protocolVersion,
      ...agentName === undefined ? {} : { agentName },
      ...agentVersion === undefined ? {} : { agentVersion },
    }
    return drv
  }

  /**
   * Create one ACP session. `mcpServers` is always empty.
   * Models come from `configOptions` on the `session/new` result.
   */
  async sessionNew(): Promise<ModelOptionsResult & { sessionId: string }> {
    const response = await this.agent.request(methods.agent.session.new, {
      cwd: this.opts.cwd,
      mcpServers: [],
    })
    this.sessionId = response.sessionId
    const models = extractModelOptions(response.configOptions ?? [])
    return { sessionId: response.sessionId, ...models }
  }

  /**
   * Pin the session default model (`session/set_config_option`).
   * No-op when there is no session yet.
   */
  async setConfigOption(configId: string, value: string): Promise<void> {
    if (this.sessionId === null) throw new AcpProtocolError('No active session', 'no_session')
    await this.agent.request(methods.agent.session.setConfigOption, {
      sessionId: this.sessionId,
      configId,
      value,
    })
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
