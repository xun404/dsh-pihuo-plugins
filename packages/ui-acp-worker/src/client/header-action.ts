/**
 * Session-header Team dock.
 * Shows the team the Leader formed in this chat (auto-seated on acp_worker).
 * Role / model / thinking can be adjusted here. Catalog add stays
 * on the settings page.
 */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { IconChevronDownOutline14, IconPlusOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from './locales.js'
import type { WorkersSectionInjected } from './settings.js'
import styles from './settings.module.css'

interface WorkerRow {
  readonly id?: string
  readonly title?: string
  readonly trusted?: boolean
  readonly enabled?: boolean
  readonly command?: string
  readonly args?: readonly string[]
  readonly model?: string
  readonly reasoning?: string
}

interface TeamMember {
  readonly workerId: string
  readonly role: string
  readonly model?: string
  readonly reasoning?: string
}

interface WorkerCatalog {
  readonly models: readonly { readonly modelId: string; readonly name: string }[]
  readonly reasoning: readonly { readonly value: string; readonly name: string }[]
  readonly currentReasoning?: string
}

function pinModelOf(member: TeamMember, worker: WorkerRow | undefined): string {
  if (member.model !== undefined && member.model !== '') return member.model
  return worker?.model ?? ''
}

function catalogKey(workerId: string, model: string): string {
  return `${workerId}::${model}`
}

function inheritThinkingLabel(t: Translate, catalog: WorkerCatalog | undefined): string {
  if (catalog === undefined) return t('teamInherit')
  if (catalog.reasoning.length === 0) return t('reasoningEmpty')
  const live = catalog.currentReasoning
  if (live === undefined || live === '') return t('teamInherit')
  const name = catalog.reasoning.find(opt => opt.value === live)?.name ?? live
  return `${t('teamInherit')} · ${name}`
}

function membersSig(rows: readonly TeamMember[]): string {
  return rows.map(row => `${row.workerId}\0${row.role}\0${row.model ?? ''}\0${row.reasoning ?? ''}`).join('\n')
}

type CatalogSlot = WorkerCatalog | 'loading' | { readonly failedAt: number }

const PROBE_BACKOFF_MS = 30_000

interface LiveRun {
  readonly workerId: string
  readonly settled?: boolean
}

const ROLES = ['general', 'coder', 'review', 'research'] as const

export type WorkersHeaderActionProps = WorkersSectionInjected & {
  t: Translate
  sessionId?: string
}

function roleLabel(t: Translate, role: string): string {
  if (role === 'general') return t('roleGeneral')
  if (role === 'coder') return t('roleCoder')
  if (role === 'review') return t('roleReview')
  if (role === 'research') return t('roleResearch')
  return role
}

function letterIcon(name: string): ReactNode {
  const letter = (name.trim()[0] ?? '?').toUpperCase()
  return createElement('span', { className: styles.dockAvatar, 'aria-hidden': true }, letter)
}

/**
 * Live team: seated members, optional add from the registered roster.
 */
export function WorkersHeaderAction(props: WorkersHeaderActionProps): ReactNode {
  const t = props.t
  const sessionId = props.sessionId ?? ''
  const [open, setOpen] = useState(false)
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [running, setRunning] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [catalogs, setCatalogs] = useState<Record<string, WorkerCatalog>>({})
  const catalogsRef = useRef<Record<string, CatalogSlot>>({})
  const rootRef = useRef<HTMLDivElement | null>(null)

  const reload = (): void => {
    void props.load().then((payload) => {
      setWorkers([...(payload.workers ?? [])].filter(row => row.enabled !== false))
    }, () => {})
    if (sessionId === '' || props.team === undefined) return
    void props.team.load(sessionId).then((payload) => {
      const next = [...(payload.members ?? [])]
      setMembers(current => membersSig(current) === membersSig(next) ? current : next)
    }, () => {})
  }

  useEffect(() => {
    reload()
    if (sessionId === '') return
    const tick = (): void => {
      if (props.team !== undefined) {
        void props.team.load(sessionId).then((payload) => {
          const next = [...(payload.members ?? [])]
          setMembers(current => membersSig(current) === membersSig(next) ? current : next)
        }, () => {})
      }
      void fetch(`/pihuo/workers/live?parent=${encodeURIComponent(sessionId)}`)
        .then(res => res.json() as Promise<{ runs?: LiveRun[] }>)
        .then((body) => {
          const ids = new Set<string>()
          for (const run of body.runs ?? []) {
            if (run.settled !== true) ids.add(run.workerId)
          }
          setRunning(ids)
        }, () => {})
    }
    tick()
    const timer = setInterval(tick, 800)
    return () => { clearInterval(timer) }
  }, [props.load, props.team, sessionId])

  useEffect(() => {
    if (!open) return
    for (const member of members) {
      const worker = workers.find(row => row.id === member.workerId)
      const command = worker?.command?.trim() ?? ''
      const pinModel = pinModelOf(member, worker)
      const key = catalogKey(member.workerId, pinModel)
      const slot = catalogsRef.current[key]
      if (command === '') continue
      if (slot === 'loading' || (slot !== undefined && !('failedAt' in slot))) continue
      if (slot !== undefined && Date.now() - slot.failedAt < PROBE_BACKOFF_MS) continue
      catalogsRef.current[key] = 'loading'
      void props.probeAcp({
        command,
        args: [...(worker?.args ?? [])],
        ...pinModel === '' ? {} : { model: pinModel },
      }).then((payload) => {
        const options = payload.reasoning?.options ?? []
        const live = payload.reasoning?.currentValue
        const liveOk = live !== undefined && live !== '' && options.some(opt => opt.value === live)
        const next: WorkerCatalog = {
          models: payload.models,
          reasoning: options,
          ...liveOk ? { currentReasoning: live } : {},
        }
        catalogsRef.current[key] = next
        setCatalogs(current => ({ ...current, [key]: next }))
      }, () => {
        catalogsRef.current[key] = { failedAt: Date.now() }
      })
    }
  }, [open, members, workers, props.probeAcp])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) !== true) {
        setOpen(false)
        setAdding(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        setAdding(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const persist = (next: TeamMember[]): void => {
    if (sessionId === '' || props.team === undefined) return
    setBusy(true)
    const cleaned = next.map(row => ({
      workerId: row.workerId,
      role: row.role,
      ...row.model === undefined || row.model === '' ? {} : { model: row.model },
      ...row.reasoning === undefined || row.reasoning === '' ? {} : { reasoning: row.reasoning },
    }))
    void props.team.save(sessionId, cleaned).then((payload) => {
      setMembers([...(payload.members ?? [])])
      setBusy(false)
      setAdding(false)
    }, () => { setBusy(false) })
  }

  const patch = (workerId: string, over: Partial<TeamMember>): void => {
    persist(members.map(item => item.workerId === workerId ? { ...item, ...over } : item))
  }

  const seatedIds = new Set(members.map(row => row.workerId))
  const available = workers.filter(row => row.id !== undefined && !seatedIds.has(row.id))
  const byId = new Map(workers.map(row => [row.id ?? '', row]))

  return createElement(
    'div',
    { className: styles.dock, ref: rootRef, 'data-acp-worker-dock': 'team' },
    createElement(
      'button',
      {
        type: 'button',
        className: `${styles.dockTrigger} ${open ? styles.dockTriggerOpen : ''}`,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'data-acp-worker-dock-trigger': '',
        onClick: () => { setOpen(current => !current); setAdding(false) },
      },
      createElement('span', { className: styles.dockLabel },
        members.length === 0 ? t('team') : `${t('team')} ${String(members.length)}`),
      createElement(IconChevronDownOutline14, { className: styles.dockChevron }),
    ),
    open
      ? createElement(
        'div',
        {
          className: `${styles.dockPanel} ${styles.dockPanelTeam}`,
          role: 'dialog',
          'aria-label': t('team'),
          'data-acp-worker-dock-panel': 'team',
        },
        createElement('p', { className: styles.dockIntro }, t('teamIntro')),
        createElement(
          'ul',
          { className: styles.dockList, 'aria-label': t('team') },
          members.length === 0
            ? createElement('li', { className: styles.dockEmpty }, t('teamEmpty'))
            : members.map((member) => {
              const worker = byId.get(member.workerId)
              const title = worker?.title ?? member.workerId
              const live = running.has(member.workerId)
              const pinModel = pinModelOf(member, worker)
              const catalog = catalogs[catalogKey(member.workerId, pinModel)]
              const modelValue = member.model ?? ''
              const liveThinking = catalog?.reasoning ?? []
              const reasoningValue = member.reasoning !== undefined
                && member.reasoning !== ''
                && liveThinking.some(opt => opt.value === member.reasoning)
                ? member.reasoning
                : ''
              const inheritModel = worker?.model !== undefined && worker.model !== ''
                ? `${t('teamInherit')} · ${worker.model}`
                : t('teamInherit')
              const inheritReasoning = inheritThinkingLabel(t, catalog)
              return createElement(
                'li',
                { key: member.workerId, className: styles.teamCard },
                createElement(
                  'div',
                  { className: styles.teamCardHead },
                  letterIcon(title),
                  createElement('span', { className: styles.dockRowGrow },
                    createElement('span', { className: styles.dockRowTitle }, title),
                    createElement('span', { className: styles.dockRowMeta },
                      live ? t('teamRunning') : t('teamIdle')),
                  ),
                  createElement('select', {
                    className: styles.dockRole,
                    disabled: busy,
                    'aria-label': t('teamRole'),
                    value: member.role,
                    onChange: (event: { target: { value: string } }) => {
                      patch(member.workerId, { role: event.target.value })
                    },
                  }, ...ROLES.map(role => createElement('option', { key: role, value: role }, roleLabel(t, role))),
                  ROLES.includes(member.role as typeof ROLES[number])
                    ? null
                    : createElement('option', { value: member.role }, member.role)),
                ),
                createElement(
                  'label',
                  { className: styles.teamField },
                  createElement('span', { className: styles.teamFieldLabel }, t('fieldModel')),
                  createElement('select', {
                    className: styles.dockConfig,
                    disabled: busy,
                    'aria-label': t('fieldModel'),
                    value: modelValue,
                    onChange: (event: { target: { value: string } }) => {
                      patch(member.workerId, { model: event.target.value, reasoning: '' })
                    },
                  },
                  createElement('option', { value: '' }, inheritModel),
                  ...(catalog?.models ?? []).map(opt => createElement('option', {
                    key: opt.modelId,
                    value: opt.modelId,
                  }, opt.name === opt.modelId ? opt.modelId : `${opt.name}`)),
                  modelValue !== '' && !(catalog?.models ?? []).some(opt => opt.modelId === modelValue)
                    ? createElement('option', { value: modelValue }, modelValue)
                    : null),
                ),
                createElement(
                  'label',
                  { className: styles.teamField },
                  createElement('span', { className: styles.teamFieldLabel }, t('fieldReasoning')),
                  createElement('select', {
                    className: styles.dockConfig,
                    disabled: busy || catalog === undefined || liveThinking.length === 0,
                    'aria-label': t('fieldReasoning'),
                    value: reasoningValue,
                    onChange: (event: { target: { value: string } }) => {
                      patch(member.workerId, { reasoning: event.target.value })
                    },
                  },
                  createElement('option', { value: '' }, inheritReasoning),
                  ...liveThinking.map(opt => createElement('option', {
                    key: opt.value,
                    value: opt.value,
                  }, opt.name === opt.value ? opt.value : opt.name))),
                ),
                createElement(
                  'div',
                  { className: styles.teamCardFoot },
                  createElement('button', {
                    type: 'button',
                    className: styles.teamRemove,
                    disabled: busy,
                    onClick: () => {
                      persist(members.filter(item => item.workerId !== member.workerId))
                    },
                  }, t('delete')),
                ),
              )
            }),
        ),
        available.length === 0
          ? null
          : adding
            ? createElement(
              'ul',
              { className: styles.dockList },
              available.map(row => createElement(
                'li',
                { key: row.id },
                createElement('button', {
                  type: 'button',
                  className: styles.dockCatalogRow,
                  disabled: busy,
                  onClick: () => {
                    const id = row.id ?? ''
                    if (id === '') return
                    persist([...members, { workerId: id, role: 'general' }])
                  },
                },
                createElement('span', { className: styles.dockRowTitle }, row.title ?? row.id),
                createElement('span', { className: styles.dockRowMeta }, row.model ?? row.id)),
              )),
            )
            : createElement('button', {
              type: 'button',
              className: styles.teamAdd,
              disabled: busy,
              onClick: () => { setAdding(true) },
            }, createElement(IconPlusOutline16, { size: 16 }), t('teamAdd')),
      )
      : null,
  )
}
