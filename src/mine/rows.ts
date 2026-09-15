import { matches } from '../ui/prompts.ts'
import type { PackageSummary } from '../registry/packument.ts'

export type SortKey = 'name' | 'published' | 'downloads' | 'deprecated'
export const SORT_KEYS: SortKey[] = ['name', 'published', 'downloads', 'deprecated']

export interface MineRow {
  name: string
  access: 'read' | 'write'
  status: 'loading' | 'loaded' | 'error'
  error?: string | undefined
  summary?: PackageSummary
  latest?: string | undefined
  tagCount?: number
  lastPublished?: string | undefined
  latestDeprecated?: boolean
  deprecatedCount?: number
  weekly?: number | undefined
  range?: number[]
  visibility?: 'public' | 'private' | undefined
}

const cmpStr = (a: string, b: string) => a.localeCompare(b)
const descUnknownLast = (a: string | number | undefined, b: string | number | undefined) => {
  if (a === undefined && b === undefined) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return a < b ? 1 : a > b ? -1 : 0
}

export function sortRows(rows: MineRow[], key: SortKey): MineRow[] {
  const out = rows
  switch (key) {
    case 'name':
      return out.toSorted((a, b) => cmpStr(a.name, b.name))
    case 'published':
      return out.toSorted(
        (a, b) => descUnknownLast(a.lastPublished, b.lastPublished) || cmpStr(a.name, b.name),
      )
    case 'downloads':
      return out.toSorted((a, b) => descUnknownLast(a.weekly, b.weekly) || cmpStr(a.name, b.name))
    case 'deprecated':
      return out.toSorted(
        (a, b) =>
          Number(Boolean(b.latestDeprecated)) - Number(Boolean(a.latestDeprecated)) ||
          cmpStr(a.name, b.name),
      )
  }
}

export function filterRows(rows: MineRow[], query: string): MineRow[] {
  return rows.filter((r) => matches(query, r.name))
}
