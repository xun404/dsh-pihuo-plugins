/**
 * Apply effective model then thought-level on an ACP session before prompt.
 * A stale or unavailable thought pin is dropped; the live ACP current is used.
 */
import {
  extractModelOptions,
  extractReasoningSelector,
  pickLiveReasoning,
  type AcpSessionDriver,
} from '@pihuo/dsh-acp-protocol'

export type SessionConfigErrorCode =
  | 'ACP_MODEL_CONFIGURATION_FAILED'
  | 'ACP_REASONING_CONFIGURATION_FAILED'

export class SessionConfigError extends Error {
  constructor(message: string, readonly code: SessionConfigErrorCode) {
    super(message)
    this.name = 'SessionConfigError'
  }
}

export interface AppliedSessionConfig {
  readonly model?: string
  readonly thinking?: string
}

/**
 * Set model, then thought-level, using the session's live `configOptions`.
 * Omitted or undeclared thought pins leave the agent default. A thought pin
 * the agent rejects still throws {@link SessionConfigError}.
 */
export async function applySessionConfig(
  driver: AcpSessionDriver,
  input: { readonly model?: string; readonly reasoning?: string },
): Promise<AppliedSessionConfig> {
  let options = [...driver.configOptions]
  let appliedModel = input.model
  if (input.model !== undefined && input.model !== '') {
    const models = extractModelOptions(options)
    const configId = models.modelConfigId
    if (configId === undefined) {
      throw new SessionConfigError(
        'This ACP agent does not declare a model selector',
        'ACP_MODEL_CONFIGURATION_FAILED',
      )
    }
    try {
      options = await driver.setConfigOption(configId, input.model)
    } catch (error) {
      throw new SessionConfigError(
        error instanceof Error ? error.message : 'Failed to set model',
        'ACP_MODEL_CONFIGURATION_FAILED',
      )
    }
    appliedModel = input.model
  }

  const selector = extractReasoningSelector(options)
  if (input.reasoning !== undefined && input.reasoning !== ''
    && selector !== undefined
    && selector.options.some(row => row.value === input.reasoning)) {
    try {
      options = await driver.setConfigOption(selector.configId, input.reasoning)
    } catch (error) {
      throw new SessionConfigError(
        error instanceof Error ? error.message : 'Failed to set thought level',
        'ACP_REASONING_CONFIGURATION_FAILED',
      )
    }
  }

  if (appliedModel === undefined) {
    const models = extractModelOptions(options)
    appliedModel = models.currentModelId
  }

  const thinking = pickLiveReasoning(extractReasoningSelector(options))
  return {
    ...appliedModel === undefined ? {} : { model: appliedModel },
    ...thinking === '' ? {} : { thinking },
  }
}
