export function timeAgo(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '—'
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24
  if (d < 14) return `${Math.floor(d)}d ago`
  if (d < 60) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export function formatCount(n: number | undefined): string {
  if (n === undefined) return '?'
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

const BARS = '▁▂▃▄▅▆▇█'

export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min
  return values
    .map((v) => {
      const i = span === 0 ? 0 : Math.round(((v - min) / span) * (BARS.length - 1))
      return BARS[i]
    })
    .join('')
}
