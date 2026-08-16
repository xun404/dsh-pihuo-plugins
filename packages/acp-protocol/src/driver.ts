import { Readable, Writable } from 'node:stream'
import {
  client,
  methods,
  ndJsonStream,
  PROTOCOL_VERSION,
  type ClientApp,
  type ClientContext,
} from '@agentclientprotocol/sdk'
import type { WorkerActivity, WorkerPermissionPolicy, WorkerPromptResult } from '@pihuo/dsh-worker-protocol'
import { extractModelOptions, parseConfigOptions, type AcpConfigOption, type ModelOptionsResult } from './models.js'
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

/** Incremental ACP session/update samples. Must not be appended as new session events. */
export type AcpActivityListener = (activity: WorkerActivity) => void

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
  private activities: WorkerActivity[] = []
  private onActivity: AcpActivityListener | undefined
  private info: AcpAgentInfo | undefined
  private _configOptions: AcpConfigOption[] = []

  private constructor(private readonly opts: AcpDriverOptions) {}

  /** Last `configOptions` from `session/new`, `set_config_option`, or a live update. */
  get configOptions(): readonly AcpConfigOption[] {
    return this._configOptions
  }

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
        const params = ctx.params as {
          update?: Record<string, unknown> & {
            sessionUpdate?: string
            content?: { type?: string; text?: unknown }
            configOptions?: unknown[]
          }
        }
        const update = params.update
        if (update === undefined) return
        if (update.sessionUpdate === 'config_option_update') {
          drv._configOptions = parseConfigOptions(update.configOptions)
          return
        }
        const activity = activityFromUpdate(update)
        if (activity === undefined) return
        if (activity.kind === 'message') drv.output += activity.text
        drv.activities.push(activity)
        try {
          drv.onActivity?.(activity)
        } catch {
          // Card/live observers must not break the ACP transport.
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
   * Models and thought-level come from `configOptions` on the `session/new` result.
   */
  async sessionNew(): Promise<ModelOptionsResult & { sessionId: string }> {
    const response = await this.agent.request(methods.agent.session.new, {
      cwd: this.opts.cwd,
      mcpServers: [],
    })
    this.sessionId = response.sessionId
    this._configOptions = parseConfigOptions(response.configOptions ?? [])
    const models = extractModelOptions(response.configOptions ?? [])
    return { sessionId: response.sessionId, ...models }
  }

  /**
   * Set one session config option (`session/set_config_option`).
   * Returns the agent's full `configOptions` after the change so the caller
   * can re-parse thought-level for the new model.
   * @throws {AcpProtocolError} `no_session` when `session/new` has not run.
   */
  async setConfigOption(configId: string, value: string): Promise<AcpConfigOption[]> {
    if (this.sessionId === null) throw new AcpProtocolError('No active session', 'no_session')
    const response = await this.agent.request(methods.agent.session.setConfigOption, {
      sessionId: this.sessionId,
      configId,
      value,
    }) as { configOptions?: unknown[] }
    this._configOptions = parseConfigOptions(response.configOptions ?? [])
    return [...this._configOptions]
  }

  /**
   * Send one text prompt and collect message / thought / tool updates.
   * Aborting `signal` notifies `session/cancel` and maps to `stopReason: aborted`.
   * Does not kill the OS process — the caller owns {@link SubprocessHandle}.
   * @returns `ok: true` only for ACP `end_turn`. Unknown stop reasons are `error`.
   */
  async prompt(
    text: string,
    signal?: AbortSignal,
    onActivity?: AcpActivityListener,
  ): Promise<WorkerPromptResult & { activities: readonly WorkerActivity[] }> {
    if (this.sessionId === null) throw new AcpProtocolError('No active session', 'no_session')
    if (signal?.aborted) {
      return { ok: false, output: this.output, stopReason: 'aborted', error: 'Cancelled', activities: [] }
    }
    this.output = ''
    this.activities = []
    this.onActivity = onActivity
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
      const activities = [...this.activities]
      if (stopReason === 'completed') {
        return { ok: true, output: this.output, stopReason, activities }
      }
      return { ok: false, output: this.output, stopReason, error: stopReason, activities }
    } finally {
      this.onActivity = undefined
      signal?.removeEventListener('abort', onAbort)
    }
  }

  /** Best-effort `session/cancel`. Safe when no session exists yet. */
  async cancel(): Promise<void> {
    if (this.sessionId === null) return
    await this.agent.notify(methods.agent.session.cancel, { sessionId: this.sessionId }).catch(() => {})
  }
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Map one ACP `session/update` into a UI activity sample.
 * Unknown update kinds are ignored so a newer agent cannot break the transport.
 */
export function activityFromUpdate(update: Record<string, unknown>): WorkerActivity | undefined {
  const kind = typeof update.sessionUpdate === 'string' ? update.sessionUpdate : ''
  if (kind === 'agent_message_chunk') {
    const content = update.content as { type?: string; text?: unknown } | undefined
    if (content?.type !== 'text') return undefined
    const text = asText(content.text)
    return text === '' ? undefined : { kind: 'message', text }
  }
  if (kind === 'agent_thought_chunk') {
    const content = update.content as { type?: string; text?: unknown } | undefined
    if (content?.type !== 'text') return undefined
    const text = asText(content.text)
    return text === '' ? undefined : { kind: 'thought', text }
  }
  if (kind === 'tool_call' || kind === 'tool_call_update') {
    const id = asText(update.toolCallId)
    const title = asText(update.title) || asText(update.kind) || 'tool'
    const status = asText(update.status)
    const detail = toolDetail(update)
    return {
      kind: 'tool',
      text: detail === '' ? title : `${title}: ${detail}`,
      ...id === '' ? {} : { toolCallId: id },
      toolTitle: title,
      ...status === '' ? {} : { toolStatus: status },
    }
  }
  if (kind === 'plan' || kind === 'plan_update') {
    const entries = Array.isArray(update.entries) ? update.entries : []
    const lines = entries
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return ''
        const row = entry as { content?: unknown; status?: unknown }
        const content = asText(row.content).trim()
        if (content === '') return ''
        const status = asText(row.status)
        return status === '' ? content : `${content} (${status})`
      })
      .filter(line => line !== '')
    if (lines.length === 0) return undefined
    return { kind: 'plan', text: lines.join('\n') }
  }
  return undefined
}

function toolDetail(update: Record<string, unknown>): string {
  const content = update.content
  if (typeof content === 'string' && content !== '') return content.slice(0, 400)
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item !== 'object' || item === null) return ''
        const rec = item as { text?: unknown; type?: unknown }
        return rec.type === 'text' ? asText(rec.text) : ''
      })
      .join('')
      .trim()
    if (text !== '') return text.slice(0, 400)
  }
  if (update.rawInput !== undefined && update.rawInput !== null) {
    try {
      const raw = typeof update.rawInput === 'string' ? update.rawInput : JSON.stringify(update.rawInput)
      if (raw !== '' && raw !== '{}' && raw !== 'null') return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw
    } catch {
      return ''
    }
  }
  return ''
}
