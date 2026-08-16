/**
 * Read the model selector out of ACP `session/new` `configOptions`.
 * Same rules as pihuo-agent: category `model` / `model_config`, or id `model*`.
 */

export interface AcpSelectItem {
  readonly value?: string
  readonly name?: string
  readonly description?: string
  readonly group?: string
  readonly options?: readonly AcpSelectItem[]
}

export interface AcpConfigOption {
  readonly id: string
  readonly category?: string
  readonly type?: string
  readonly currentValue?: string
  readonly options?: readonly AcpSelectItem[]
}

export interface WorkerModelOption {
  readonly modelId: string
  readonly name: string
  readonly description?: string
}

export type ModelOptionsErrorCode =
  | 'ACP_MODELS_NOT_DECLARED'
  | 'ACP_MODELS_NO_MODEL_OPTION'
  | 'ACP_MODELS_EMPTY_VALUES'

export interface ModelOptionsResult {
  readonly ok: boolean
  readonly models: readonly WorkerModelOption[]
  readonly currentModelId?: string
  readonly modelConfigId?: string
  readonly error?: string
  readonly errorCode?: ModelOptionsErrorCode
}

const MODEL_CATEGORIES = new Set(['model', 'model_config'])

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function isModelConfig(opt: AcpConfigOption): boolean {
  if (opt.category !== undefined && MODEL_CATEGORIES.has(opt.category)) return true
  if (opt.id === 'model') return true
  return /^model/i.test(opt.id)
}

function isSelect(opt: AcpConfigOption): boolean {
  return opt.type === 'select' && Array.isArray(opt.options)
}

function readSelectItem(raw: unknown): AcpSelectItem | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const rec = raw as Record<string, unknown>
  const value = asString(rec.value)
  const name = asString(rec.name)
  const description = asString(rec.description)
  const group = asString(rec.group)
  const nested = Array.isArray(rec.options)
    ? rec.options.map(readSelectItem).filter((item): item is AcpSelectItem => item !== undefined)
    : undefined
  return {
    ...value === undefined ? {} : { value },
    ...name === undefined ? {} : { name },
    ...description === undefined ? {} : { description },
    ...group === undefined ? {} : { group },
    ...nested === undefined ? {} : { options: nested },
  }
}

function readConfigOption(raw: unknown): AcpConfigOption | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const rec = raw as Record<string, unknown>
  const id = asString(rec.id)
  if (id === undefined) return undefined
  const category = asString(rec.category)
  const type = asString(rec.type)
  const currentValue = asString(rec.currentValue)
  const options = Array.isArray(rec.options)
    ? rec.options.map(readSelectItem).filter((item): item is AcpSelectItem => item !== undefined)
    : undefined
  return {
    id,
    ...category === undefined ? {} : { category },
    ...type === undefined ? {} : { type },
    ...currentValue === undefined ? {} : { currentValue },
    ...options === undefined ? {} : { options },
  }
}

/**
 * Flatten one `session/new` configOptions array into selectable models.
 */
export function extractModelOptions(
  configOptions: readonly unknown[] | null | undefined,
): ModelOptionsResult {
  const parsed = (configOptions ?? [])
    .map(readConfigOption)
    .filter((item): item is AcpConfigOption => item !== undefined)
  if (parsed.length === 0) {
    return {
      ok: false,
      models: [],
      error: 'ACP agent did not declare any configOptions',
      errorCode: 'ACP_MODELS_NOT_DECLARED',
    }
  }

  const modelOpts = parsed.filter(isModelConfig)
  if (modelOpts.length === 0) {
    return {
      ok: false,
      models: [],
      error: 'No model-like configOption found in session configOptions',
      errorCode: 'ACP_MODELS_NO_MODEL_OPTION',
    }
  }

  const seen = new Set<string>()
  const models: WorkerModelOption[] = []
  let currentModelId: string | undefined
  let modelConfigId: string | undefined

  for (const opt of modelOpts) {
    if (!isSelect(opt)) continue
    if (modelConfigId === undefined) modelConfigId = opt.id
    for (const item of opt.options ?? []) {
      if (item.group !== undefined && item.options !== undefined) {
        for (const sub of item.options) {
          if (sub.value !== undefined && sub.value !== '' && !seen.has(sub.value)) {
            seen.add(sub.value)
            models.push({
              modelId: sub.value,
              name: sub.name === undefined || sub.name === '' ? sub.value : sub.name,
              ...sub.description === undefined || sub.description === ''
                ? {}
                : { description: sub.description },
            })
          }
        }
      } else if (item.value !== undefined && item.value !== '' && !seen.has(item.value)) {
        seen.add(item.value)
        models.push({
          modelId: item.value,
          name: item.name === undefined || item.name === '' ? item.value : item.name,
          ...item.description === undefined || item.description === ''
            ? {}
            : { description: item.description },
        })
      }
    }
    if (opt.currentValue !== undefined && opt.currentValue !== '' && currentModelId === undefined) {
      currentModelId = opt.currentValue
    }
  }

  if (models.length === 0) {
    return {
      ok: false,
      models: [],
      ...currentModelId === undefined ? {} : { currentModelId },
      ...modelConfigId === undefined ? {} : { modelConfigId },
      error: 'Model config option found but no selectable values declared',
      errorCode: 'ACP_MODELS_EMPTY_VALUES',
    }
  }

  return {
    ok: true,
    models,
    ...currentModelId === undefined ? {} : { currentModelId },
    ...modelConfigId === undefined ? {} : { modelConfigId },
  }
}
