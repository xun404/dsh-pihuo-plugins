/**
 * Bundled ACP worker templates. These fill command/args on the settings page.
 * They never spawn or download. Adding a row fills a local command name;
 * start() still requires a passing check (`trusted`).
 */

/** How the catalog row was produced. */
export type CatalogEntrySource = 'registry' | 'bundled'

/** One install-it-yourself ACP CLI the settings page can prefill. */
export interface WorkerCatalogEntry {
  /** Suggested roster id when the user adds this template. */
  readonly id: string
  /** Settings-page title. */
  readonly title: string
  /** One-line summary from the registry or a bundled template. */
  readonly summary: string
  /** Executable the template fills. Empty for the blank custom row. */
  readonly command: string
  /** Argv tokens the template fills. */
  readonly args: readonly string[]
  /** `registry` rows come from the official ACP index. */
  readonly source?: CatalogEntrySource
  /** Official distribution used to prefill command/args. */
  readonly distribution?: 'npx' | 'uvx' | 'binary'
  /** npm/uv package used when the user asks this plugin to install. */
  readonly packageSpec?: string
  /** Registry package version, when known. */
  readonly version?: string
  /** Official CDN icon (`https://cdn.agentclientprotocol.com/…`). */
  readonly icon?: string
  /** Agent authors from the index. */
  readonly authors?: readonly string[]
  /** Source repository URL, when the index publishes one. */
  readonly repository?: string
  /** Product site URL, when the index publishes one. */
  readonly website?: string
  /** SPDX or product license string from the index. */
  readonly license?: string
}

/**
 * Curated templates. Keep this list local-binary only — no `npx`/`uvx` rows,
 * because those download and run unsigned code outside the dsh sandbox.
 */
export const WORKER_CATALOG: readonly WorkerCatalogEntry[] = [
  {
    id: 'opencode',
    title: 'OpenCode',
    summary: 'Local `opencode acp`. This template does not download anything.',
    command: 'opencode',
    args: ['acp'],
    source: 'bundled',
  },
  {
    id: 'custom',
    title: 'Custom ACP CLI',
    summary: 'Fill in the executable and arguments yourself. The child is not sandboxed.',
    command: '',
    args: [],
    source: 'bundled',
  },
]
