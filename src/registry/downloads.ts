import { errorMessage } from '../errors.ts'

export type FetchJson = (url: string) => Promise<unknown>

const API = 'https://api.npmjs.org/downloads'
const BULK_LIMIT = 128

/** Resolves `null` for a package the API has no stats for, the same as a missing name in a bulk reply. */
export const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

export function explain(err: unknown): string {
  const msg = errorMessage(err)
  if (msg.startsWith('429')) return 'rate limited by api.npmjs.org (429), try again in a minute'
  return msg
}

export function batches(names: string[]): string[][] {
  const scoped = names.filter((n) => n.startsWith('@')).map((n) => [n])
  const unscoped = names.filter((n) => !n.startsWith('@'))
  const groups: string[][] = []
  for (let i = 0; i < unscoped.length; i += BULK_LIMIT)
    groups.push(unscoped.slice(i, i + BULK_LIMIT))
  return [...scoped, ...groups]
}

interface Point {
  downloads: number
  package: string
}

// api.npmjs.org rate-limits per client; a burst of one request per package trips it, so keep this low.
const CONCURRENCY = 3

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    await new Promise((r) => setTimeout(r, 300))
    return fn()
  }
}

/** Counts by package; `error` carries the last failure so the UI can say why a count is missing. */
export type WeeklyCounts = Map<string, number> & { error?: string }

export async function weeklyDownloads(
  names: string[],
  fetchJson: FetchJson = defaultFetchJson,
): Promise<WeeklyCounts> {
  const out: WeeklyCounts = new Map<string, number>()
  const queue = batches(names)
  const worker = async () => {
    for (let group = queue.shift(); group; group = queue.shift()) {
      try {
        const json = await withRetry(() => fetchJson(`${API}/point/last-week/${group!.join(',')}`))
        if (group.length === 1) {
          out.set(group[0]!, (json as Point | null)?.downloads ?? 0)
          continue
        }
        const bulk = json as Record<string, Point | null> | null
        for (const name of group) out.set(name, bulk?.[name]?.downloads ?? 0)
      } catch (err) {
        // Leave the count undefined so the UI renders "?" and surfaces the reason once.
        out.error = explain(err)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return out
}

export async function rangeDownloads(
  name: string,
  fetchJson: FetchJson = defaultFetchJson,
): Promise<number[]> {
  const json = (await withRetry(() => fetchJson(`${API}/range/last-month/${name}`))) as {
    downloads: { day: string; downloads: number }[]
  } | null
  return json?.downloads.map((d) => d.downloads) ?? []
}
