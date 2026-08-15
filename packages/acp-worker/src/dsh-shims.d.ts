/**
 * Compile-time faces for first-party packages that are not installed in this
 * workspace. At runtime the dsh profile supplies the real modules.
 */

declare module '@deepseek-ai/cordis' {
  export interface Context {
    readonly subagents: {
      registerProvider(provider: object): () => void
    }
    readonly subprocess: {
      spawn(spec: import('@deepseek-ai/dsh-subprocess').SubprocessSpawnSpec): import('@deepseek-ai/dsh-subprocess').SubprocessHandle
    }
    readonly logger: { warn(message: string): void }
  }
}

declare module '@deepseek-ai/dsh-session' {
  export type SessionId = string & { readonly __brand: 'SessionId' }
  export function SessionId(id: string): SessionId
}

declare module '@deepseek-ai/dsh-subagent' {
  import type { SessionId } from '@deepseek-ai/dsh-session'
  import type { WorkerStopReason } from '@pihuo/dsh-worker-protocol'

  export interface SubagentCapabilities {
    readonly outputSchema: boolean
    readonly depthLimit: boolean
    readonly toolFilter: boolean
    readonly persona: boolean
  }

  export interface ResolvedSubagentStartRequest {
    readonly prompt: ReadonlyArray<{ readonly type: string; readonly text?: string }>
    readonly parent: { readonly session: { readonly header: { readonly cwd?: string } } }
    readonly signal: AbortSignal
  }

  export interface SubagentResult {
    readonly output: Array<{ type: 'text'; text: string }>
    readonly stopReason: WorkerStopReason
  }

  export interface SubagentRun {
    readonly id: SessionId
    readonly localAgent: undefined
    readonly result: Promise<SubagentResult>
    dispose(): Promise<void>
  }

  export interface SubagentProvider {
    readonly name: string
    readonly capabilities: SubagentCapabilities
    readonly inheritsParentContext: boolean
    start(request: ResolvedSubagentStartRequest): Promise<SubagentRun>
  }
}

declare module '@deepseek-ai/dsh-subprocess' {
  export interface SubprocessSpawnSpec {
    readonly argv: readonly string[]
    readonly cwd: string
    readonly stdio: { readonly stdin: 'pipe'; readonly stdout: 'pipe'; readonly stderr: 'inherit' }
    readonly graceMs: number
    readonly env: Record<string, string>
  }

  export interface SubprocessHandle {
    readonly stdin?: import('node:stream').Writable
    readonly stdout?: import('node:stream').Readable
    readonly done: Promise<unknown>
    terminate(): void
    waitForExit(): Promise<boolean>
  }
}
