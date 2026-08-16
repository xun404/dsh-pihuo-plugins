/**
 * Settings page for the ACP worker roster.
 * Cards expand in place like plugin configuration. The catalog is a
 * searchable preset-style grid. Talks to same-origin /pihuo/workers,
 * /pihuo/catalog, /pihuo/workers/probe, /pihuo/workers/models.
 */
import { createElement, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { IconChevronDownOutline14, IconPlusOutline16, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import styles from './settings.module.css'
import type { Translate, WorkersKey } from './locales.js'
import { watchAcpNavIcon } from './nav-icon.js'

interface WorkerCheckView {
  readonly kind: 'ready' | 'missing' | 'failed'
  readonly name?: string
}

interface WorkerDraft {
  id: string
  title: string
  trusted: boolean
  catalogId: string
  enabled: boolean
  command: string
  argsText: string
  model: string
  reasoning: string
  idleTtlMs: string
  poolMax: string
  packageSpec: string
  distribution: '' | 'npx' | 'uvx' | 'binary'
  check?: WorkerCheckView
}

interface WorkerRow {
  readonly id?: string
  readonly title?: string
  readonly trusted?: boolean
  readonly catalogId?: string
  readonly enabled?: boolean
  readonly command?: string
  readonly args?: readonly string[]
  readonly model?: string
  readonly reasoning?: string
  readonly idleTtlMs?: number
  readonly poolMax?: number
  readonly packageSpec?: string
  readonly distribution?: 'npx' | 'uvx' | 'binary'
  readonly check?: WorkerCheckView
}

interface CatalogEntry {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly command: string
  readonly args: readonly string[]
  readonly source?: 'registry' | 'bundled'
  readonly distribution?: 'npx' | 'uvx' | 'binary'
  readonly packageSpec?: string
  readonly version?: string
  readonly icon?: string
  readonly authors?: readonly string[]
  readonly repository?: string
  readonly website?: string
  readonly license?: string
}

interface CatalogPayload {
  readonly catalog: readonly CatalogEntry[]
  readonly source?: 'live' | 'lkg' | 'bundled'
  readonly version?: string
}

interface RosterPayload {
  readonly revision?: number
  readonly lastError?: string
  readonly workers?: readonly WorkerRow[]
  readonly status?: { readonly poolSize?: number }
}

export interface TeamMemberDto {
  readonly workerId: string
  readonly role: string
  readonly model?: string
  readonly reasoning?: string
}

/** Inject face. The `t` seat arrives from `locale: pihuo.workers` on register. */
export interface WorkerModelOption {
  readonly modelId: string
  readonly name: string
}

export interface ReasoningOption {
  readonly value: string
  readonly name: string
}

export interface ReasoningSelector {
  readonly configId: string
  readonly currentValue?: string
  readonly options: readonly ReasoningOption[]
}

export interface ModelsPayload {
  readonly ok: boolean
  readonly models: readonly WorkerModelOption[]
  readonly currentModelId?: string
  readonly reasoning?: ReasoningSelector
  readonly error?: string
}

export interface AcpProbePayload {
  readonly ok: boolean
  readonly status: 'ready' | 'auth_required' | 'incompatible' | 'failed'
  readonly code: string
  readonly message: string
  readonly models: readonly WorkerModelOption[]
  readonly currentModelId?: string
  readonly reasoning?: ReasoningSelector
  readonly agentName?: string
  readonly agentVersion?: string
  readonly protocolVersion?: number
}

export interface WorkersSectionInjected {
  load(): Promise<RosterPayload>
  save(workers: readonly Record<string, unknown>[]): Promise<RosterPayload>
  catalog(opts?: { refresh?: boolean }): Promise<CatalogPayload>
  probe(input: {
    command: string
    workerId?: string
    distribution?: 'npx' | 'uvx' | 'binary'
  }): Promise<{ found: boolean; path?: string }>
  models(input: { command: string; args: readonly string[]; model?: string }): Promise<ModelsPayload>
  probeAcp(input: { command: string; args: readonly string[]; model?: string }): Promise<AcpProbePayload>
  team: {
    load(sessionId: string): Promise<{ members: readonly TeamMemberDto[] }>
    save(sessionId: string, members: readonly TeamMemberDto[]): Promise<{ members: readonly TeamMemberDto[] }>
  }
  startInstall(input: {
    workerId: string
    packageSpec: string
    distribution: 'npx' | 'uvx'
    commandName: string
  }): Promise<InstallJobPayload>
  installStatus(id: string): Promise<InstallJobPayload>
}

export interface InstallJobPayload {
  readonly id: string
  readonly status: 'running' | 'ok' | 'failed'
  readonly log: string
  readonly command?: string
  readonly error?: string
}

export type WorkersSectionProps = WorkersSectionInjected & {
  t: Translate
  /** `page` is the settings section; `popover` is the chat-header dock. */
  variant?: 'page' | 'popover'
}

function catalogKey(id: string, part: 'title' | 'summary'): WorkersKey {
  return `catalog_${id}_${part}` as WorkersKey
}

function catalogText(t: Translate, entry: CatalogEntry, part: 'title' | 'summary'): string {
  if (entry.source === 'registry') {
    return part === 'title' ? entry.title : entry.summary
  }
  const key = catalogKey(entry.id, part)
  const translated = t(key)
  return translated === key ? (part === 'title' ? entry.title : entry.summary) : translated
}

function distLabel(t: Translate, entry: CatalogEntry): string | null {
  if (entry.distribution === 'npx') return t('distNpx')
  if (entry.distribution === 'uvx') return t('distUvx')
  if (entry.distribution === 'binary') return t('distBinary')
  return null
}

function hostPath(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')
    return `${parsed.host}${path}`
  } catch {
    return url
  }
}

function officialCatalog(rows: readonly CatalogEntry[]): CatalogEntry[] {
  return rows.filter(row => row.id !== 'custom')
}

function AgentIcon(props: { src: string | undefined; title: string; size: 'sm' | 'md' | 'lg' }): ReactNode {
  const sizeClass = props.size === 'lg' ? styles.iconLg : props.size === 'sm' ? styles.iconSm : styles.iconMd
  if (props.src !== undefined && props.src !== '') {
    return createElement('span', {
      className: `${styles.icon} ${sizeClass}`,
      style: { WebkitMaskImage: `url("${props.src}")`, maskImage: `url("${props.src}")` },
      role: 'img',
      'aria-label': props.title,
    })
  }
  const letter = (props.title.trim()[0] ?? '?').toUpperCase()
  return createElement('span', { className: `${styles.iconFallback} ${sizeClass}`, 'aria-hidden': true }, letter)
}

function aboutLink(label: string, href: string): ReactNode {
  return createElement(
    'a',
    {
      key: href,
      className: styles.aboutLink,
      href,
      target: '_blank',
      rel: 'noopener noreferrer',
      onClick: (event: { stopPropagation(): void }) => { event.stopPropagation() },
    },
    createElement('span', { className: styles.aboutLinkLabel }, label),
    createElement('span', { className: styles.aboutLinkUrl }, hostPath(href)),
  )
}

function AboutBlock(props: { entry: CatalogEntry; t: Translate }): ReactNode {
  const summary = catalogText(props.t, props.entry, 'summary')
  const authors = (props.entry.authors ?? []).join(' · ')
  const repo = props.entry.repository === undefined
    ? null
    : aboutLink(props.t('fieldRepo'), props.entry.repository)
  if (summary === '' && authors === '' && repo === null) return null
  return createElement(
    'div',
    { className: styles.about, 'data-acp-about': props.entry.id },
    summary !== '' ? createElement('p', { className: styles.aboutDesc }, summary) : null,
    authors !== ''
      ? createElement('div', { className: styles.aboutAuthors }, `${props.t('fieldAuthors')} · ${authors}`)
      : null,
    repo !== null ? createElement('div', { className: styles.aboutLinks }, repo) : null,
  )
}

function sourceLine(t: Translate, source: CatalogPayload['source'], version: string | undefined): string {
  const params = { version: version === undefined || version === '' ? '—' : version }
  if (source === 'live') return t('catalogSourceLive', params)
  if (source === 'lkg') return t('catalogSourceLkg', params)
  return t('catalogSourceBundled')
}

function rowTitle(t: Translate, row: WorkerRow): string {
  if (row.id === 'default' && (row.title === undefined || row.title === '' || row.title === 'Default')) {
    return t('defaultTitle')
  }
  return row.title ?? row.id ?? 'worker'
}

function commandLine(row: { command?: string; args?: readonly string[] }): string {
  return `${row.command ?? ''} ${(row.args ?? []).join(' ')}`.trim()
}

function emptyDraft(id: string): WorkerDraft {
  return {
    id,
    title: id,
    trusted: false,
    catalogId: '',
    enabled: true,
    command: '',
    argsText: '',
    model: '',
    reasoning: '',
    idleTtlMs: '300000',
    poolMax: '4',
    packageSpec: '',
    distribution: '',
  }
}

function fromRow(row: WorkerRow): WorkerDraft {
  return {
    id: row.id ?? '',
    title: row.title ?? row.id ?? '',
    trusted: row.trusted === true,
    catalogId: row.catalogId ?? '',
    enabled: row.enabled !== false,
    command: row.command ?? '',
    argsText: (row.args ?? []).join('\n'),
    model: row.model ?? '',
    reasoning: row.reasoning ?? '',
    idleTtlMs: String(row.idleTtlMs ?? 300000),
    poolMax: String(row.poolMax ?? 4),
    packageSpec: row.packageSpec ?? '',
    distribution: row.distribution ?? '',
    ...row.check === undefined ? {} : { check: row.check },
  }
}

function toRow(draft: WorkerDraft): Record<string, unknown> {
  return {
    id: draft.id.trim(),
    title: draft.title.trim() === '' ? draft.id.trim() : draft.title.trim(),
    trusted: draft.trusted,
    enabled: draft.enabled,
    command: draft.command.trim(),
    args: draft.argsText.split('\n').map(line => line.trim()).filter(line => line !== ''),
    ...draft.model.trim() === '' ? {} : { model: draft.model.trim() },
    ...draft.reasoning.trim() === '' ? {} : { reasoning: draft.reasoning.trim() },
    ...draft.catalogId === '' ? {} : { catalogId: draft.catalogId },
    idleTtlMs: Number(draft.idleTtlMs),
    poolMax: Number(draft.poolMax),
    ...draft.packageSpec.trim() === '' ? {} : { packageSpec: draft.packageSpec.trim() },
    ...draft.distribution === '' ? {} : { distribution: draft.distribution },
    ...draft.check === undefined ? {} : { check: draft.check },
  }
}

function checkFromProbe(probe: AcpProbePayload): WorkerCheckView {
  if (probe.ok) return { kind: 'ready' }
  if (probe.code === 'ACP_RUNNER_MISSING') {
    return { kind: 'missing', name: probe.message }
  }
  if (probe.code === 'WORKER_AUTH_REQUIRED') {
    return { kind: 'failed', name: 'auth' }
  }
  return { kind: 'failed' }
}

function rowStatus(row: WorkerRow): { kind: 'off' | 'ready' | 'missing' | 'failed' | 'unchecked'; name?: string } {
  if (row.enabled === false) return { kind: 'off' }
  if (row.check?.kind === 'ready' || (row.check === undefined && row.trusted === true)) {
    return { kind: 'ready' }
  }
  if (row.check?.kind === 'missing') {
    return { kind: 'missing', ...row.check.name === undefined ? {} : { name: row.check.name } }
  }
  if (row.check?.kind === 'failed') return { kind: 'failed' }
  return { kind: 'unchecked' }
}

function statusLabel(t: Translate, status: ReturnType<typeof rowStatus>): string {
  if (status.kind === 'off') return t('tagOff')
  if (status.kind === 'ready') return t('tagReady')
  if (status.kind === 'missing') return t('tagMissing')
  if (status.kind === 'failed') return t('tagFailed')
  return t('tagUnchecked')
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const root = /^[a-z][a-z0-9_-]{0,63}$/.test(base) ? base : 'worker'
  if (!taken.has(root)) return root
  let n = 2
  while (taken.has(`${root}-${String(n)}`)) n += 1
  return `${root}-${String(n)}`
}

function field(label: string, child: ReactNode, hint?: string): ReactNode {
  return createElement(
    'div',
    { key: label, className: styles.field },
    createElement(
      'div',
      { className: styles.fieldHead },
      createElement('label', { className: styles.fieldLabel }, label),
    ),
    child,
    hint === undefined ? null : createElement('p', { className: styles.fieldHint }, hint),
  )
}

function textInput(value: string, onChange: (value: string) => void, extra?: Record<string, unknown>): ReactNode {
  return createElement('input', {
    className: styles.fieldInput,
    value,
    onChange: (event: { target: { value: string } }) => { onChange(event.target.value) },
    ...extra,
  })
}

function probeReason(probe: Pick<AcpProbePayload, 'code' | 'message'>, t: Translate): string {
  if (probe.code === 'ACP_RUNNER_MISSING') return t('needCommand', { name: probe.message })
  if (probe.code === 'PROBE_TIMEOUT') return t('probeTimeout')
  if (probe.code === 'WORKER_AUTH_REQUIRED') return t('needAuth')
  return t('checkFailed')
}

const WORKER_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/

function draftIssue(
  draft: WorkerDraft,
  workers: readonly WorkerRow[],
  editingIndex: number | 'new' | null,
  t: Translate,
): string | null {
  if (!WORKER_ID_RE.test(draft.id.trim())) return t('invalidId')
  const taken = workers.some((row, index) => {
    if (row.id !== draft.id.trim()) return false
    return editingIndex === 'new' || editingIndex === null || index !== editingIndex
  })
  if (taken) return t('duplicateId')
  const command = draft.command.trim()
  const args = draft.argsText.split('\n').map(line => line.trim()).filter(line => line !== '')
  if (draft.enabled && (command === '' || (command === 'node' && args.length === 0))) {
    return t('invalidCommand')
  }
  const idle = Number(draft.idleTtlMs)
  if (!Number.isInteger(idle) || idle < 1) return t('invalidIdle')
  const pool = Number(draft.poolMax)
  if (!Number.isInteger(pool) || pool < 1 || pool > 16) return t('invalidPool')
  return null
}

function installPlan(draft: WorkerDraft, catalog: readonly CatalogEntry[]): {
  packageSpec: string
  distribution: 'npx' | 'uvx'
  commandName: string
} | null {
  const fromCatalog = catalog.find(entry => entry.id === draft.catalogId)
  const spec = draft.packageSpec.trim() !== '' ? draft.packageSpec.trim() : (fromCatalog?.packageSpec ?? '')
  const dist = draft.distribution !== '' ? draft.distribution : fromCatalog?.distribution
  if (spec === '' || (dist !== 'npx' && dist !== 'uvx')) return null
  const commandName = draft.command.trim().split(/[/\\]/).pop() ?? draft.command.trim()
  if (commandName === '' || commandName === 'npx' || commandName === 'uvx') return null
  return { packageSpec: spec, distribution: dist, commandName }
}

function isCatalogAdded(entry: CatalogEntry, rows: readonly WorkerRow[]): boolean {
  return rows.some(row => row.catalogId === entry.id || row.id === entry.id)
}

/**
 * PiHuo Workers roster. The list is the home surface; edit expands in the
 * selected card. Catalog is a searchable picker, not a separate settings tab.
 */
export function WorkersSection(props: WorkersSectionProps): ReactNode {
  const t = props.t
  const popover = props.variant === 'popover'
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([])
  const [catalogSource, setCatalogSource] = useState<CatalogPayload['source']>()
  const [catalogVersion, setCatalogVersion] = useState<string | undefined>()
  const [catalogReady, setCatalogReady] = useState(false)
  const [draft, setDraft] = useState<WorkerDraft>(emptyDraft('default'))
  const [editingIndex, setEditingIndex] = useState<number | 'new' | null>(null)
  const [picker, setPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'ok' | 'warn'>('ok')
  const [poolSize, setPoolSize] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [installJob, setInstallJob] = useState<InstallJobPayload | null>(null)
  const [pendingEntry, setPendingEntry] = useState<CatalogEntry | null>(null)
  const [installName, setInstallName] = useState('')
  const installingEntryRef = useRef<CatalogEntry | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [refreshing, setRefreshing] = useState(false)
  const [modelOptions, setModelOptions] = useState<readonly WorkerModelOption[]>([])
  const [reasoningOptions, setReasoningOptions] = useState<readonly ReasoningOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsNote, setModelsNote] = useState<string | null>(null)
  const [reasoningNote, setReasoningNote] = useState<string | null>(null)
  const [reasoningLive, setReasoningLive] = useState('')
  const pageRef = useRef<HTMLDivElement | null>(null)
  const installLogRef = useRef<HTMLPreElement | null>(null)

  useEffect(() => (popover ? undefined : watchAcpNavIcon()), [popover])

  useEffect(() => {
    const root = pageRef.current
    if (root === null) return
    let pane: HTMLElement | null = root
    while (pane !== null && pane.scrollHeight <= pane.clientHeight + 1) {
      pane = pane.parentElement
    }
    pane?.scrollTo({ top: 0 })
  }, [picker])

  const applyPayload = (payload: RosterPayload): void => {
    setWorkers([...(payload.workers ?? [])])
    setPoolSize(payload.status?.poolSize ?? 0)
    if (payload.lastError !== undefined) {
      setMessage(payload.lastError)
      setMessageKind('warn')
    }
  }

  useEffect(() => {
    let live = true
    void props.load().then((payload) => {
      if (!live) return
      applyPayload(payload)
    }, (error: unknown) => {
      if (live) {
        setMessage(error instanceof Error ? error.message : String(error))
        setMessageKind('warn')
      }
    })
    void props.catalog().then((payload) => {
      if (!live) return
      setCatalog(officialCatalog(payload.catalog))
      setCatalogSource(payload.source)
      setCatalogVersion(payload.version)
      setCatalogReady(true)
    }, () => {
      if (!live) return
      setCatalog([])
      setCatalogSource('bundled')
      setCatalogReady(true)
    })
    return () => {
      live = false
    }
  }, [props.load, props.catalog])

  const applyReasoning = (selector: ReasoningSelector | undefined, keepValue: string): void => {
    const options = selector?.options ?? []
    setReasoningOptions(options)
    const live = selector?.currentValue
    const liveOk = live !== undefined && live !== '' && options.some(row => row.value === live)
    setReasoningLive(liveOk ? (options.find(row => row.value === live)?.name ?? live) : '')
    if (options.length === 0) {
      setReasoningNote(t('reasoningEmpty'))
      setDraft(current => ({ ...current, reasoning: '' }))
      return
    }
    setReasoningNote(null)
    const next = keepValue !== '' && options.some(row => row.value === keepValue) ? keepValue : ''
    setDraft(current => ({ ...current, reasoning: next }))
  }

  const loadModels = (draftToLoad: WorkerDraft): void => {
    const command = draftToLoad.command.trim()
    const args = draftToLoad.argsText.split('\n').map(line => line.trim()).filter(line => line !== '')
    if (command === '') {
      setModelOptions([])
      setReasoningOptions([])
      setReasoningLive('')
      setModelsNote(null)
      setReasoningNote(null)
      setModelsLoading(false)
      return
    }
    setModelsLoading(true)
    setModelsNote(null)
    void props.probeAcp({
      command,
      args,
      ...draftToLoad.model.trim() === '' ? {} : { model: draftToLoad.model.trim() },
    }).then((payload) => {
      setModelOptions(payload.models)
      setModelsNote(payload.ok && payload.models.length === 0 ? t('modelEmpty') : null)
      applyReasoning(payload.reasoning, draftToLoad.reasoning)
      setDraft(current => ({ ...current, check: checkFromProbe(payload) }))
      setModelsLoading(false)
    }, (error: unknown) => {
      setModelOptions([])
      setReasoningOptions([])
      setModelsNote(error instanceof Error ? error.message : t('modelEmpty'))
      setModelsLoading(false)
    })
  }

  const persist = (next: WorkerRow[], note?: string, onOk?: () => void, kind: 'ok' | 'warn' = 'ok'): void => {
    setBusy(true)
    void props.save(next.map((row) => toRow(fromRow(row)))).then((payload) => {
      applyPayload(payload)
      if (payload.lastError === undefined) {
        setMessage(note ?? t('saved'))
        setMessageKind(kind)
        onOk?.()
      }
      setBusy(false)
    }, (error: unknown) => {
      setMessage(error instanceof Error ? error.message : String(error))
      setMessageKind('warn')
      setBusy(false)
    })
  }

  const runCheckAndSave = (nextDraft: WorkerDraft): void => {
    const issue = draftIssue(nextDraft, workers, editingIndex, t)
    if (issue !== null) {
      setMessage(issue)
      setMessageKind('warn')
      return
    }
    const command = nextDraft.command.trim()
    const args = nextDraft.argsText.split('\n').map(line => line.trim()).filter(line => line !== '')
    const finish = (
      trusted: boolean,
      note: string,
      check: WorkerCheckView,
      kind: 'ok' | 'warn',
      draft: WorkerDraft = nextDraft,
    ): void => {
      const next = [...workers]
      const row = toRow({ ...draft, trusted, check }) as WorkerRow
      if (editingIndex === 'new' || editingIndex === null) next.push(row)
      else next[editingIndex] = row
      persist(next, note, () => {
        setInstallJob(null)
        setEditingIndex(null)
        setPicker(false)
        setConfirmDelete(false)
      }, kind)
    }
    if (command === '') {
      finish(false, t('saved'), { kind: 'failed' }, 'warn')
      return
    }
    setBusy(true)
    setMessage(t('saveProbing'))
    setMessageKind('ok')
    void props.probeAcp({
      command,
      args,
      ...nextDraft.model.trim() === '' ? {} : { model: nextDraft.model.trim() },
    }).then((probe) => {
      setModelOptions(probe.models)
      const check = checkFromProbe(probe)
      const options = probe.reasoning?.options ?? []
      const pinned = nextDraft.reasoning.trim()
      const reasoning = pinned !== '' && options.some(row => row.value === pinned) ? pinned : ''
      const saved = { ...nextDraft, reasoning }
      if (probe.ok) {
        finish(true, t('probeReady'), check, 'ok', saved)
        return
      }
      finish(false, probeReason(probe, t), check, 'warn', saved)
    }, () => {
      finish(false, t('checkFailed'), { kind: 'failed' }, 'warn')
    })
  }

  const persistDraft = (event: FormEvent): void => {
    event.preventDefault()
    runCheckAndSave(draft)
  }

  const startInstall = (entry: CatalogEntry): void => {
    const spec = entry.packageSpec ?? ''
    const dist = entry.distribution
    if (spec === '' || (dist !== 'npx' && dist !== 'uvx')) return
    installingEntryRef.current = entry
    setInstallName(catalogText(t, entry, 'title'))
    setPendingEntry(null)
    setBusy(true)
    void props.startInstall({
      workerId: entry.id,
      packageSpec: spec,
      distribution: dist,
      commandName: entry.command,
    }).then((job) => {
      setInstallJob(job)
    }, (error: unknown) => {
      setBusy(false)
      setMessage(error instanceof Error ? error.message : String(error))
      setMessageKind('warn')
    })
  }

  const openInstalled = (entry: CatalogEntry, command: string): void => {
    const draftNext: WorkerDraft = {
      ...emptyDraft(entry.id),
      title: catalogText(t, entry, 'title'),
      catalogId: entry.id,
      command,
      argsText: entry.args.join('\n'),
      packageSpec: entry.packageSpec ?? '',
      distribution: entry.distribution ?? '',
    }
    setDraft(draftNext)
    setEditingIndex('new')
    setPicker(false)
    setAdvanced(false)
    setConfirmDelete(false)
    setMessage(null)
    loadModels(draftNext)
  }

  const pickCatalog = (entry: CatalogEntry): void => {
    if (isCatalogAdded(entry, workers)) return
    setBusy(true)
    void props.probe({
      command: entry.command,
      workerId: entry.id,
      ...entry.distribution === undefined ? {} : { distribution: entry.distribution },
    }).then((hit) => {
      setBusy(false)
      if (hit.found) {
        openInstalled(entry, hit.path ?? entry.command)
        return
      }
      setPendingEntry(entry)
    }, () => {
      setBusy(false)
      setPendingEntry(entry)
    })
  }

  useEffect(() => {
    const el = installLogRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [installJob?.log])

  useEffect(() => {
    if (installJob === null || installJob.status !== 'running') return
    const timer = window.setInterval(() => {
      void props.installStatus(installJob.id).then((next) => {
        setInstallJob(next)
        if (next.status === 'ok' && next.command !== undefined && next.command !== '') {
          const entry = installingEntryRef.current
          installingEntryRef.current = null
          setInstallJob(null)
          setBusy(false)
          if (entry !== null) {
            openInstalled(entry, next.command)
            return
          }
          const updated = { ...draftRef.current, command: next.command }
          setDraft(updated)
          runCheckAndSave(updated)
        }
        if (next.status === 'failed') {
          setBusy(false)
          setMessage(t('installFailed'))
          setMessageKind('warn')
        }
      }, () => {})
    }, 400)
    return () => { window.clearInterval(timer) }
  }, [installJob?.id, installJob?.status])

  const openCustom = (): void => {
    const taken = new Set(workers.map(row => row.id ?? ''))
    const id = uniqueId('worker', taken)
    setDraft({
      ...emptyDraft(id),
      title: t('catalog_custom_title'),
    })
    setEditingIndex('new')
    setPicker(false)
    setAdvanced(false)
    setConfirmDelete(false)
    setMessage(null)
  }

  const refreshCatalog = (): void => {
    setRefreshing(true)
    void props.catalog({ refresh: true }).then((payload) => {
      setCatalog(officialCatalog(payload.catalog))
      setCatalogSource(payload.source)
      setCatalogVersion(payload.version)
      setCatalogReady(true)
      setMessage(payload.source === 'live' ? t('refreshOk') : t('refreshFail'))
      setMessageKind(payload.source === 'live' ? 'ok' : 'warn')
      setRefreshing(false)
    }, (error: unknown) => {
      setMessage(error instanceof Error ? error.message : t('refreshFail'))
      setMessageKind('warn')
      setRefreshing(false)
    })
  }

  const openEdit = (index: number): void => {
    if (editingIndex === index) {
      setEditingIndex(null)
      setConfirmDelete(false)
      return
    }
    const row = workers[index]
    if (row === undefined) return
    const next = fromRow(row)
    setDraft(next)
    setEditingIndex(index)
    setPicker(false)
    setAdvanced(false)
    setConfirmDelete(false)
    loadModels(next)
  }

  const removeCurrent = (): void => {
    if (editingIndex === 'new' || editingIndex === null) {
      setEditingIndex(null)
      setConfirmDelete(false)
      return
    }
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    persist(workers.filter((_, index) => index !== editingIndex), t('deleted'), () => {
      setEditingIndex(null)
      setConfirmDelete(false)
    })
  }

  const filteredCatalog = catalog.filter((entry) => {
    const q = query.trim().toLowerCase()
    if (q === '') return true
    const hay = [
      entry.id,
      catalogText(t, entry, 'title'),
      catalogText(t, entry, 'summary'),
      entry.command,
      entry.distribution ?? '',
      entry.version ?? '',
      ...(entry.authors ?? []),
      entry.repository ?? '',
      entry.website ?? '',
      ...entry.args,
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })

  const editor = createElement(
    'form',
    { 'data-pihuo-workers': 'form', className: styles.editor, onSubmit: persistDraft },
    draft.check?.kind === 'failed'
      ? createElement('p', { className: styles.warn, 'data-pihuo-check': 'failed' },
        draft.check.name === 'auth' ? t('needAuth') : t('checkFailed'))
      : null,
    (() => {
      const about = catalog.find(entry => entry.id === draft.catalogId)
      return about === undefined ? null : AboutBlock({ entry: about, t })
    })(),
    field(t('fieldId'), textInput(draft.id, (id) => { setDraft({ ...draft, id }) }, {
      disabled: draft.catalogId !== '',
      readOnly: draft.catalogId !== '',
    })),
    field(t('fieldTitle'), textInput(draft.title, (title) => { setDraft({ ...draft, title }) })),
    field(t('fieldCommand'), textInput(draft.command, (command) => { setDraft({ ...draft, command }) }, {
      disabled: draft.catalogId !== '',
      readOnly: draft.catalogId !== '',
    })),
    field(t('fieldArgs'), createElement('textarea', {
      className: styles.fieldTextarea,
      value: draft.argsText,
      rows: 3,
      disabled: draft.catalogId !== '',
      readOnly: draft.catalogId !== '',
      placeholder: t('argsPlaceholder'),
      onChange: (event: { target: { value: string } }) => setDraft({ ...draft, argsText: event.target.value }),
    })),
    field(t('fieldModel'), createElement(
      'div',
      { className: styles.modelRow, 'data-pihuo-model-field': '' },
      modelOptions.length > 0
        ? createElement(
          'select',
          {
            className: styles.fieldInput,
            value: draft.model,
            disabled: modelsLoading,
            'aria-label': t('fieldModel'),
            onChange: (event: { target: { value: string } }) => {
              const model = event.target.value
              const next = { ...draft, model, reasoning: '' }
              setDraft(next)
              if (model !== '') loadModels(next)
            },
          },
          createElement('option', { value: '' }, t('modelAgentDefault')),
          ...modelOptions.map(opt => createElement('option', {
            key: opt.modelId,
            value: opt.modelId,
          }, opt.name === opt.modelId ? opt.modelId : `${opt.name}`)),
          draft.model !== '' && !modelOptions.some(opt => opt.modelId === draft.model)
            ? createElement('option', { value: draft.model }, draft.model)
            : null,
        )
        : textInput(draft.model, (model) => { setDraft({ ...draft, model }) }, {
          placeholder: modelsLoading ? t('modelLoading') : 'provider/model',
          disabled: modelsLoading,
        }),
      createElement('button', {
        type: 'button',
        className: styles.iconButton,
        disabled: modelsLoading || draft.command.trim() === '',
        'aria-label': t('modelRefresh'),
        onClick: () => { loadModels(draft) },
      }, createElement(IconRefreshOutline16, { size: 16 }), modelsLoading ? t('modelLoading') : t('modelRefresh')),
    ), modelsNote ?? undefined),
    field(t('fieldReasoning'), createElement(
      'select',
      {
        className: styles.fieldInput,
        value: reasoningOptions.some(opt => opt.value === draft.reasoning) ? draft.reasoning : '',
        disabled: modelsLoading || reasoningOptions.length === 0,
        'aria-label': t('fieldReasoning'),
        onChange: (event: { target: { value: string } }) => {
          setDraft({ ...draft, reasoning: event.target.value })
        },
      },
      createElement('option', { value: '' },
        reasoningLive === '' ? t('reasoningAgentDefault') : `${t('reasoningAgentDefault')} · ${reasoningLive}`),
      ...reasoningOptions.map(opt => createElement('option', {
        key: opt.value,
        value: opt.value,
      }, opt.name === opt.value ? opt.value : opt.name)),
    ), reasoningNote ?? undefined),
    createElement('button', {
      type: 'button',
      className: styles.advancedBtn,
      onClick: () => { setAdvanced(!advanced) },
    }, advanced ? t('advancedHide') : t('advanced')),
    advanced
      ? field(t('fieldIdleTtl'), textInput(draft.idleTtlMs, (idleTtlMs) => { setDraft({ ...draft, idleTtlMs }) }))
      : null,
    advanced
      ? field(t('fieldPoolMax'), textInput(draft.poolMax, (poolMax) => { setDraft({ ...draft, poolMax }) }))
      : null,
    createElement(
      'div',
      { className: styles.workerFooter },
      createElement(
        'div',
        { className: styles.footerGrow },
        createElement('button', {
          type: 'button',
          className: styles.deleteBtn,
          disabled: busy,
          onClick: removeCurrent,
        }, editingIndex === 'new' || editingIndex === null
          ? t('cancel')
          : confirmDelete ? t('confirmDelete') : t('delete')),
      ),
      editingIndex === 'new' || editingIndex === null
        ? null
        : createElement('button', {
          type: 'button',
          className: styles.discard,
          disabled: busy,
          onClick: () => {
            setEditingIndex(null)
            setConfirmDelete(false)
          },
        }, t('discard')),
      createElement(
        'label',
        { className: styles.footerSwitch },
        createElement('span', null, t('fieldEnabled')),
        createElement('input', {
          type: 'checkbox',
          checked: draft.enabled,
          'aria-label': t('fieldEnabled'),
          onChange: (event: { target: { checked: boolean } }) => {
            setDraft({ ...draft, enabled: event.target.checked })
          },
        }),
      ),
      createElement('button', {
        type: 'submit',
        className: styles.save,
        disabled: busy || installJob?.status === 'running',
        'data-pihuo-save-state': busy ? 'probing' : 'idle',
      }, busy ? t('saveProbing') : t('save')),
    ),
  )

  return createElement(
    'div',
    {
      'data-pihuo-workers': picker ? 'catalog' : 'list',
      'data-pihuo-variant': popover ? 'popover' : 'page',
      className: popover ? `${styles.page} ${styles.popover}` : styles.page,
      ref: pageRef,
    },
    popover ? null : createElement('h2', { className: styles.title }, t('title')),
    createElement('p', { className: styles.intro }, picker ? t('catalogIntro') : t('listIntro')),
    picker
      ? createElement(
        'div',
        { className: styles.toolbar },
        createElement('input', {
          className: styles.searchInput,
          value: query,
          placeholder: t('searchPlaceholder'),
          'aria-label': t('search'),
          onChange: (event: { target: { value: string } }) => { setQuery(event.target.value) },
        }),
        createElement('button', {
          type: 'button',
          className: styles.iconButton,
          disabled: refreshing,
          'aria-label': t('refresh'),
          onClick: refreshCatalog,
        }, createElement(IconRefreshOutline16, { size: 16 }), refreshing ? t('refreshing') : t('refresh')),
        createElement('button', {
          type: 'button',
          className: styles.iconButton,
          onClick: () => { setPicker(false); setQuery('') },
        }, t('back')),
      )
      : null,
    picker
      ? createElement(
        'div',
        {
          className: styles.catalog,
          'data-pihuo-catalog-source': catalogSource ?? '',
          'data-pihuo-catalog-version': catalogVersion ?? '',
          'data-pihuo-catalog-count': String(catalog.length),
          'data-pihuo-catalog-state': catalogReady ? 'ready' : 'loading',
        },
        createElement('p', { className: styles.status, 'data-pihuo-catalog-banner': '' },
          catalogReady
            ? `${sourceLine(t, catalogSource, catalogVersion)} · ${t('catalogCount', { n: catalog.length })}`
            : t('catalogLoading')),
        createElement(
          'ul',
          { className: styles.catalogGrid },
          filteredCatalog.map(entry => createElement(
            'li',
            { key: entry.id },
            createElement(
              'button',
              {
                type: 'button',
                className: isCatalogAdded(entry, workers)
                  ? `${styles.catalogCard} ${styles.catalogCardOff}`
                  : styles.catalogCard,
                'data-catalog-id': entry.id,
                'data-catalog-source': entry.source ?? '',
                'data-catalog-distribution': entry.distribution ?? '',
                'data-catalog-added': isCatalogAdded(entry, workers) ? 'true' : 'false',
                disabled: isCatalogAdded(entry, workers) || busy,
                onClick: () => { pickCatalog(entry) },
              },
              createElement(
                'span',
                { className: styles.catalogMain },
                createElement(
                  'span',
                  { className: styles.catalogHead },
                  AgentIcon({ src: entry.icon, title: catalogText(t, entry, 'title'), size: 'md' }),
                  createElement('span', { className: styles.catalogName }, catalogText(t, entry, 'title')),
                  isCatalogAdded(entry, workers)
                    ? createElement('span', { className: styles.badge }, t('catalogAdded'))
                    : distLabel(t, entry) !== null
                      ? createElement('span', { className: styles.badge }, distLabel(t, entry))
                      : null,
                  entry.version !== undefined && entry.version !== ''
                    ? createElement('span', { className: styles.badge }, entry.version)
                    : null,
                ),
                createElement('span', { className: styles.catalogDesc }, catalogText(t, entry, 'summary')),
                (entry.authors ?? []).length > 0
                  ? createElement('span', { className: styles.aboutAuthors }, (entry.authors ?? []).join(' · '))
                  : null,
                createElement('code', { className: styles.catalogId }, commandLine(entry) || entry.id),
              ),
            ),
          )),
        ),
      )
      : createElement(
        'ul',
        { className: styles.cards },
        workers.length === 0 && editingIndex !== 'new'
          ? createElement('li', { className: styles.status }, t('empty'))
          : null,
        ...workers.map((row, index) => {
          const open = editingIndex === index
          return createElement(
            'li',
            {
              key: row.id ?? String(index),
              className: open ? `${styles.workerCard} ${styles.workerCardOpen}` : styles.workerCard,
              'data-pihuo-worker-card': row.id ?? '',
              'data-pihuo-worker-open': open ? 'true' : 'false',
            },
            createElement(
              'button',
              {
                type: 'button',
                className: styles.workerHeader,
                'aria-expanded': open,
                onClick: () => { openEdit(index) },
              },
              AgentIcon({
                src: catalog.find(entry => entry.id === row.catalogId)?.icon,
                title: rowTitle(t, row),
                size: 'md',
              }),
              createElement(
                'span',
                { className: styles.headText },
                createElement('span', { className: styles.workerName }, rowTitle(t, row)),
                createElement('span', { className: styles.workerDesc },
                  `${row.id ?? ''} · ${commandLine(row)}`.replace(/ · $/, '')),
              ),
              createElement(
                'span',
                { className: styles.badges },
                (() => {
                  const status = rowStatus(row)
                  const on = status.kind === 'ready'
                  return createElement('span', {
                    className: `${styles.badge} ${on ? styles.badgeOn : styles.badgeWarn}`,
                    'data-pihuo-status': status.kind,
                  }, statusLabel(t, status))
                })(),
              ),
              createElement(IconChevronDownOutline14, {
                className: open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron,
              }),
            ),
            open ? createElement('div', { className: styles.workerBody }, editor) : null,
          )
        }),
        editingIndex === 'new'
          ? createElement(
            'li',
            { key: 'new', className: `${styles.workerCard} ${styles.workerCardOpen}` },
            createElement(
              'button',
              {
                type: 'button',
                className: styles.workerHeader,
                'aria-expanded': true,
                onClick: () => { setEditingIndex(null); setConfirmDelete(false) },
              },
              AgentIcon({
                src: catalog.find(entry => entry.id === draft.catalogId)?.icon,
                title: draft.title,
                size: 'md',
              }),
              createElement(
                'span',
                { className: styles.headText },
                createElement('span', { className: styles.workerName }, draft.title || t('addCustom')),
                createElement('span', { className: styles.workerDesc }, draft.id),
              ),
              createElement(IconChevronDownOutline14, {
                className: `${styles.chevron} ${styles.chevronOpen}`,
              }),
            ),
            createElement('div', { className: styles.workerBody }, editor),
          )
          : null,
      ),
    picker
      ? null
      : createElement(
        'div',
        { className: styles.addRow },
        createElement('button', {
          type: 'button',
          className: styles.addFromCatalog,
          onClick: () => {
            setPicker(true)
            setEditingIndex(null)
            setQuery('')
          },
        }, createElement(IconPlusOutline16, { size: 14 }), t('addFromCatalog')),
        createElement('button', {
          type: 'button',
          className: styles.addCustom,
          onClick: openCustom,
        }, createElement(IconPlusOutline16, { size: 14 }), t('addCustom')),
      ),
    picker || poolSize === null
      ? null
      : createElement('p', { className: styles.status }, t('poolSize', { n: poolSize })),
    message !== null
      ? createElement('p', {
        'data-pihuo-workers-message': '',
        className: messageKind === 'ok' ? styles.ok : styles.warn,
      }, message)
      : null,
    pendingEntry === null
      ? null
      : createElement(
        'div',
        { className: styles.overlay, 'data-pihuo-missing': pendingEntry.id },
        createElement(
          'div',
          { className: styles.installDialog, role: 'dialog' },
          createElement('p', { className: styles.promptText },
            t('missingNeedInstall', { name: catalogText(t, pendingEntry, 'title') })),
          createElement(
            'div',
            { className: styles.promptActions },
            createElement('button', {
              type: 'button',
              className: styles.discard,
              onClick: () => { setPendingEntry(null) },
            }, t('cancel')),
            pendingEntry.packageSpec !== undefined && pendingEntry.packageSpec !== ''
              && (pendingEntry.distribution === 'npx' || pendingEntry.distribution === 'uvx')
              ? createElement('button', {
                type: 'button',
                className: styles.save,
                onClick: () => { startInstall(pendingEntry) },
              }, t('install'))
              : null,
          ),
        ),
      ),
    installJob === null
      ? null
      : createElement(
        'div',
        { className: styles.overlay, 'data-pihuo-install': installJob.status },
        createElement(
          'div',
          { className: styles.installDialog, role: 'dialog', 'aria-label': t('installTitle', { name: draft.title }) },
          createElement('h3', { className: styles.installTitle },
            t('installTitle', { name: installName || draft.title || draft.command })),
          createElement('pre', {
            ref: installLogRef,
            className: styles.installLog,
          }, installJob.log),
          installJob.status === 'failed'
            ? createElement('p', { className: styles.warn },
              installJob.error === undefined ? t('installFailed') : `${t('installFailed')}：${installJob.error}`)
            : null,
          installJob.status === 'running'
            ? null
            : createElement('button', {
              type: 'button',
              className: styles.discard,
              onClick: () => { setInstallJob(null); setBusy(false) },
            }, t('installClose')),
        ),
      ),
  )
}
