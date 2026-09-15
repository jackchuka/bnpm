import { errorMessage, isAuthError } from '../errors.ts'
import { summarize, type Packument } from '../registry/packument.ts'
import type { PackageAccess } from '../registry/client.ts'
import type { MineRow } from './rows.ts'
import type { WeeklyCounts } from '../registry/downloads.ts'

export interface MineSource {
  whoami(): Promise<string>
  userPackages(user: string): Promise<PackageAccess>
  packument(name: string): Promise<Packument>
  weekly(names: string[]): Promise<WeeklyCounts>
  range(name: string): Promise<number[]>
  visibility(name: string): Promise<'public' | 'private'>
}

export interface MineStore {
  readonly rows: MineRow[]
  readonly user: string | undefined
  readonly loadError: string | undefined
  /** The load failed for want of credentials, so retrying it unchanged cannot help. */
  readonly authFailed: boolean
  readonly downloadsError: string | undefined
  /** Bumps on every change; use as the external-store snapshot so error-only updates re-render. */
  readonly version: number
  subscribe(fn: () => void): () => void
  retryDownloads(): Promise<void>
  load(): Promise<void>
  refresh(name: string): Promise<void>
  loadRange(name: string): Promise<void>
  loadVisibility(name: string): Promise<void>
}

async function pooled<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item)
  })
  await Promise.all(workers)
}

export function createStore(source: MineSource, opts: { concurrency?: number } = {}): MineStore {
  const concurrency = opts.concurrency ?? 8
  let rows: MineRow[] = []
  let user: string | undefined
  let loadError: string | undefined
  let authFailed = false
  let downloadsError: string | undefined
  let version = 0
  const listeners = new Set<() => void>()
  const emit = () => {
    version++
    listeners.forEach((fn) => fn())
  }

  const patch = (name: string, changes: Partial<MineRow>) => {
    rows = rows.map((r) => (r.name === name ? { ...r, ...changes } : r))
    emit()
  }

  const enrich = async (name: string) => {
    try {
      const summary = summarize(await source.packument(name))
      patch(name, {
        status: 'loaded',
        error: undefined,
        summary,
        latest: summary.latest,
        tagCount: Object.keys(summary.distTags).length,
        lastPublished: summary.lastPublished,
        latestDeprecated: summary.latestDeprecated,
        deprecatedCount: summary.deprecatedCount,
      })
    } catch (err) {
      patch(name, { status: 'error', error: errorMessage(err) })
    }
  }

  const loadWeekly = async (names: string[]) => {
    let counts: WeeklyCounts
    try {
      counts = await source.weekly(names)
    } catch (err) {
      counts = Object.assign(new Map<string, number>(), { error: errorMessage(err) })
    }
    downloadsError = counts.error
    rows = rows.map((r) => (counts.has(r.name) ? { ...r, weekly: counts.get(r.name) } : r))
    emit()
  }

  return {
    get rows() {
      return rows
    },
    get user() {
      return user
    },
    get loadError() {
      return loadError
    },
    get authFailed() {
      return authFailed
    },
    get downloadsError() {
      return downloadsError
    },
    get version() {
      return version
    },
    async retryDownloads() {
      const missing = rows.filter((r) => r.weekly === undefined).map((r) => r.name)
      if (missing.length === 0) return
      await loadWeekly(missing)
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    async load() {
      if (loadError) {
        loadError = undefined
        authFailed = false
        emit()
      }
      try {
        // `user` stays unset until the list is known: the UI reads it as "still loading".
        const name = await source.whoami()
        const pkgs = await source.userPackages(name)
        user = name
        rows = Object.entries(pkgs).map(([n, access]) => ({
          name: n,
          access,
          status: 'loading' as const,
        }))
      } catch (err) {
        loadError = errorMessage(err)
        authFailed = isAuthError(err)
        throw err
      } finally {
        emit()
      }
      if (rows.length === 0) return
      const names = rows.map((r) => r.name)
      await Promise.all([pooled(names, concurrency, enrich), loadWeekly(names)])
    },
    async refresh(name) {
      patch(name, { status: 'loading' })
      await enrich(name)
    },
    async loadVisibility(name) {
      try {
        patch(name, { visibility: await source.visibility(name) })
      } catch {
        // Unknown visibility is shown as blank; the access flow still works without it.
      }
    },
    async loadRange(name) {
      if (rows.find((r) => r.name === name)?.range) return
      try {
        patch(name, { range: await source.range(name) })
      } catch {
        // Leave range unset so the next visit retries instead of showing an empty sparkline.
      }
    },
  }
}
