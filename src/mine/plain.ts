import { formatCount, timeAgo } from './format.ts'
import type { MineRow } from './rows.ts'

export function renderPlain(rows: MineRow[], now: Date = new Date()): string {
  const header = ['PACKAGE', 'LATEST', 'TAGS', 'PUBLISHED', 'DOWNLOADS/WK', 'STATUS'].join('\t')
  const lines = rows.map((r) =>
    [
      r.name,
      r.latest ?? '',
      r.tagCount ?? '',
      timeAgo(r.lastPublished, now),
      formatCount(r.weekly),
      r.status === 'error' ? `error: ${r.error}` : r.latestDeprecated ? 'deprecated' : '',
    ].join('\t'),
  )
  return [header, ...lines].join('\n')
}
