/**
 * Model list is the ACP probe's `configOptions` slice.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Config as PluginConfig } from './config.js'
import { probeWorkerAcp, type ProbeAcpInput } from './probe-acp.js'
import type { WorkerModelOption, WorkerReasoningSelector } from '@pihuo/dsh-acp-protocol'

export interface ListModelsInput {
  readonly command: string
  readonly args?: readonly string[]
  /** When set, pin this model before reading thought-level. */
  readonly model?: string
}

export interface ListModelsResult {
  readonly ok: boolean
  readonly models: readonly WorkerModelOption[]
  readonly currentModelId?: string
  readonly reasoning?: WorkerReasoningSelector
  readonly error?: string
}

export async function listWorkerModels(
  ctx: Context,
  plugin: PluginConfig,
  input: ListModelsInput,
): Promise<ListModelsResult> {
  const probe = await probeWorkerAcp(ctx, plugin, input as ProbeAcpInput)
  return {
    ok: probe.ok,
    models: probe.models,
    ...probe.currentModelId === undefined ? {} : { currentModelId: probe.currentModelId },
    ...probe.reasoning === undefined ? {} : { reasoning: probe.reasoning },
    ...probe.ok ? {} : { error: probe.message },
  }
}
