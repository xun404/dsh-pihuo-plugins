/** ACP 1.2 client driver and stop/permission maps. No process spawn lives here. */
export { acpStopReason } from './stop-reason.js'
export { decideAskPermission, pickAutoPermission } from './permission.js'
export { extractModelOptions, parseConfigOptions } from './models.js'
export type {
  AcpConfigOption, AcpSelectItem, ModelOptionsErrorCode, ModelOptionsResult, WorkerModelOption,
} from './models.js'
export { extractReasoningSelector, pickLiveReasoning, reasoningLabel } from './reasoning.js'
export type { WorkerReasoningOption, WorkerReasoningSelector } from './reasoning.js'
export { AcpProtocolError, AcpSessionDriver, activityFromUpdate } from './driver.js'
export type { AcpActivityListener, AcpAgentInfo, AcpDriverOptions, PermissionDecision } from './driver.js'
