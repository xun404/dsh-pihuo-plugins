/**
 * Read the thought-level selector out of ACP `configOptions`.
 * Prefers `category: thought_level`, then ids `reasoning_effort` / `effort`.
 * Values stay agent-native strings.
 */
import {
  type AcpConfigOption,
  type AcpSelectItem,
  type WorkerModelOption,
} from './models.js'

/** One thought-level choice the agent declared. */
export interface WorkerReasoningOption {
  readonly value: string
  readonly name: string
  readonly description?: string
}

/**
 * The select the current session will accept for thought level.
 * Absent when the agent (or this model) does not declare one.
 */
export interface WorkerReasoningSelector {
  readonly configId: string
  readonly currentValue?: string
  readonly options: readonly WorkerReasoningOption[]
}

const REASONING_CATEGORY = 'thought_level'

const KNOWN_REASONING_IDS: ReadonlySet<string> = new Set(['reasoning_effort', 'effort'])

function flattenSelect(items: readonly AcpSelectItem[] | undefined): WorkerReasoningOption[] {
  const result: WorkerReasoningOption[] = []
  const seen = new Set<string>()
  for (const item of items ?? []) {
    if (item.group !== undefined && item.options !== undefined) {
      for (const child of flattenSelect(item.options)) {
        if (!seen.has(child.value)) {
          seen.add(child.value)
          result.push(child)
        }
      }
      continue
    }
    if (item.value === undefined || item.value === '' || seen.has(item.value)) continue
    seen.add(item.value)
    result.push({
      value: item.value,
      name: item.name === undefined || item.name === '' ? item.value : item.name,
      ...item.description === undefined || item.description === '' ? {} : { description: item.description },
    })
  }
  return result
}

function asSelect(opt: AcpConfigOption): boolean {
  return opt.type === 'select' && Array.isArray(opt.options)
}

/**
 * Pick one thought-level select from a `configOptions` array.
 * Returns `undefined` when none is declared or the select has no values.
 */
export function extractReasoningSelector(
  options: readonly AcpConfigOption[] | null | undefined,
): WorkerReasoningSelector | undefined {
  if (options === undefined || options === null || options.length === 0) return undefined

  let candidate: AcpConfigOption | undefined
  for (const opt of options) {
    if (opt.category === REASONING_CATEGORY && asSelect(opt)) {
      candidate = opt
      break
    }
  }
  if (candidate === undefined) {
    for (const opt of options) {
      if (KNOWN_REASONING_IDS.has(opt.id) && asSelect(opt)) {
        candidate = opt
        break
      }
    }
  }
  if (candidate === undefined) return undefined

  const flattened = flattenSelect(candidate.options)
  if (flattened.length === 0) return undefined
  return {
    configId: candidate.id,
    ...candidate.currentValue === undefined || candidate.currentValue === ''
      ? {}
      : { currentValue: candidate.currentValue },
    options: flattened,
  }
}

/** Display name for a stored reasoning value, or the raw value. */
export function reasoningLabel(
  selector: WorkerReasoningSelector | undefined,
  value: string | undefined,
): string | undefined {
  if (value === undefined || value === '') return selector?.currentValue
  const hit = selector?.options.find(row => row.value === value)
  return hit?.name ?? value
}

/**
 * The thought-level the current ACP session is actually on.
 * Ignores a stored pin: that value is not live until `setConfigOption` runs.
 */
export function pickLiveReasoning(selector: WorkerReasoningSelector | undefined): string {
  const live = selector?.currentValue
  if (live === undefined || live === '') return ''
  if (selector?.options.some(row => row.value === live) !== true) return ''
  return live
}

/** Re-export so callers can keep one option vocabulary. */
export type { WorkerModelOption }
