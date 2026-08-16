/**
 * Session-header dock for the ACP worker roster.
 * Same shape as the jobs popover: a count trigger and a compact list.
 */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  IconChevronDownOutline14, IconPlusOutline16, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
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
  readonly catalogId?: string
  readonly check?: { readonly kind?: string }
}

interface CatalogEntry {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly command: string
  readonly args: readonly string[]
  readonly icon?: string
  readonly distribution?: 'npx' | 'uvx' | 'binary'
}

export type WorkersHeaderActionProps = WorkersSectionInjected & {
  t: Translate
}

function commandLine(row: { command?: string; args?: readonly string[] }): string {
  return `${row.command ?? ''} ${(row.args ?? []).join(' ')}`.trim()
}

function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const root = /^[a-z][a-z0-9_-]{0,63}$/.test(base) ? base : 'worker'
  if (!taken.has(root)) return root
  let n = 2
  while (taken.has(`${root}-${String(n)}`)) n += 1
  return `${root}-${String(n)}`
}

/**
 * Jobs-style roster: trigger in the session header, list plus add in a popover.
 */
export function WorkersHeaderAction(props: WorkersHeaderActionProps): ReactNode {
  const t = props.t
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const [query, setQuery] = useState('')
  const [workers, setWorkers] = useState<WorkerRow[]>([])
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [poolSize, setPoolSize] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const reload = (): void => {
    void props.load().then((payload) => {
      setWorkers([...(payload.workers ?? [])])
      setPoolSize(payload.status?.poolSize ?? 0)
    }, () => {})
  }

  useEffect(() => {
    reload()
    void props.catalog().then((payload) => {
      setCatalog((payload.catalog ?? []).filter(row => row.id !== 'custom'))
    }, () => {})
  }, [props.load, props.catalog])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) !== true) {
        setOpen(false)
        setPicker(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false)
        setPicker(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const persist = (next: WorkerRow[]): void => {
    setBusy(true)
    void props.save(next as unknown as readonly Record<string, unknown>[]).then((payload) => {
      setWorkers([...(payload.workers ?? [])])
      setBusy(false)
      setPicker(false)
    }, () => { setBusy(false) })
  }

  const addFrom = (entry: CatalogEntry): void => {
    if (workers.some(row => row.catalogId === entry.id || row.id === entry.id)) return
    setBusy(true)
    void props.probe({
      command: entry.command,
      workerId: entry.id,
      ...entry.distribution === undefined ? {} : { distribution: entry.distribution },
    }).then((hit) => {
      if (!hit.found) {
        setBusy(false)
        return
      }
      persist([...workers, {
        id: entry.id,
        title: entry.title,
        catalogId: entry.id,
        command: hit.path ?? entry.command,
        args: [...entry.args],
        enabled: true,
        trusted: false,
      }])
    }, () => { setBusy(false) })
  }

  const filtered = catalog.filter((entry) => {
    const q = query.trim().toLowerCase()
    if (q === '') return true
    return `${entry.id} ${entry.title} ${entry.summary} ${entry.command}`.toLowerCase().includes(q)
  })

  return createElement(
    'div',
    { className: styles.dock, ref: rootRef, 'data-acp-worker-dock': '' },
    createElement(
      'button',
      {
        type: 'button',
        className: `${styles.dockTrigger} ${open ? styles.dockTriggerOpen : ''}`,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'data-acp-worker-dock-trigger': '',
        onClick: () => { setOpen(current => !current); setPicker(false) },
      },
      poolSize > 0 ? createElement(StateDot, { state: 'ongoing', size: 10 }) : null,
      createElement('span', { className: styles.dockLabel },
        workers.length === 0 ? t('nav') : `${t('nav')} ${String(workers.length)}`),
      createElement(IconChevronDownOutline14, { className: styles.dockChevron }),
    ),
    open
      ? createElement(
        'div',
        {
          className: styles.dockPanel,
          role: 'dialog',
          'aria-label': t('nav'),
          'data-acp-worker-dock-panel': picker ? 'catalog' : 'list',
        },
        picker
          ? createElement(
            'div',
            { className: styles.dockPicker },
            createElement('input', {
              className: styles.dockSearch,
              value: query,
              placeholder: t('searchPlaceholder'),
              onChange: (event: { target: { value: string } }) => { setQuery(event.target.value) },
            }),
            createElement('button', {
              type: 'button',
              className: styles.dockBack,
              onClick: () => { setPicker(false); setQuery('') },
            }, t('back')),
            filtered.map(entry => createElement(
              'button',
              {
                key: entry.id,
                type: 'button',
                className: workers.some(row => row.catalogId === entry.id || row.id === entry.id)
                  ? `${styles.dockCatalogRow} ${styles.catalogCardOff}`
                  : styles.dockCatalogRow,
                'data-catalog-id': entry.id,
                'data-catalog-added': workers.some(row => row.catalogId === entry.id || row.id === entry.id)
                  ? 'true'
                  : 'false',
                disabled: busy || workers.some(row => row.catalogId === entry.id || row.id === entry.id),
                onClick: () => { addFrom(entry) },
              },
              createElement('span', { className: styles.dockRowTitle }, entry.title),
              createElement('span', { className: styles.dockRowMeta }, commandLine(entry) || entry.summary),
            )),
          )
          : createElement(
            'ul',
            { className: styles.dockList, 'aria-label': t('nav') },
            workers.length === 0
              ? createElement('li', { className: styles.dockEmpty }, t('empty'))
              : workers.map((row, index) => createElement(
                'li',
                { key: row.id ?? String(index), className: styles.dockRow },
                createElement(StateDot, {
                  state: row.trusted === true && row.enabled !== false ? 'done' : 'warning',
                  size: 10,
                }),
                createElement('span', { className: styles.dockRowGrow },
                  createElement('span', { className: styles.dockRowTitle }, row.title ?? row.id ?? 'worker'),
                  createElement('span', { className: styles.dockRowMeta }, commandLine(row)),
                ),
                createElement('span', {
                  className: `${styles.tag} ${row.enabled === false ? '' : row.trusted === true || row.check?.kind === 'ready' ? styles.tagOn : styles.tagWarn}`,
                }, row.enabled === false
                  ? t('tagOff')
                  : row.check?.kind === 'missing'
                    ? t('tagMissing')
                    : row.check?.kind === 'failed'
                      ? t('tagFailed')
                      : row.trusted === true || row.check?.kind === 'ready'
                        ? t('tagReady')
                        : t('tagUnchecked')),
              )),
            createElement(
              'li',
              { className: styles.dockAdd },
              createElement('button', {
                type: 'button',
                className: styles.addFromCatalog,
                disabled: busy,
                onClick: () => { setPicker(true); setQuery('') },
              }, createElement(IconPlusOutline16, { size: 16 }), t('addFromCatalog')),
              createElement('button', {
                type: 'button',
                className: styles.addCustom,
                disabled: busy,
                onClick: () => {
                  addFrom({
                    id: 'custom',
                    title: t('catalog_custom_title'),
                    summary: '',
                    command: '',
                    args: [],
                  })
                },
              }, createElement(IconPlusOutline16, { size: 16 }), t('addCustom')),
            ),
          ),
      )
      : null,
  )
}
