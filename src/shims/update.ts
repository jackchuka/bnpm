import semver from 'semver'
import type { DepType } from '../pkgjson.ts'
import { execNpm, npmJson } from '../npm/exec.ts'
import { p, pick, pickMany, showCommand } from '../ui/prompts.ts'
import pc from '../ui/colors.ts'

export interface OutdatedRow {
  name: string
  current: string | undefined
  wanted: string
  latest: string
  type: DepType
  major: boolean
}

interface OutdatedEntry {
  current?: string
  wanted: string
  latest: string
  type?: string
}

const TYPE_MAP: Record<string, DepType> = {
  dependencies: 'prod',
  devDependencies: 'dev',
  optionalDependencies: 'optional',
  peerDependencies: 'peer',
}

export function parseOutdated(
  json: Record<string, OutdatedEntry | OutdatedEntry[]>,
): OutdatedRow[] {
  return Object.entries(json).flatMap(([name, v]) => {
    const entries = Array.isArray(v) ? v : [v]
    return entries.map((e) => {
      const major =
        e.current !== undefined &&
        semver.valid(e.current) !== null &&
        semver.valid(e.latest) !== null &&
        semver.major(e.latest) > semver.major(e.current)
      return {
        name,
        current: e.current,
        wanted: e.wanted,
        latest: e.latest,
        type: TYPE_MAP[e.type ?? ''] ?? 'prod',
        major,
      }
    })
  })
}

export function planUpdate(rows: OutdatedRow[], target: 'wanted' | 'latest'): string[] {
  return ['install', ...rows.map((r) => `${r.name}@${r[target]}`)]
}

export async function updateShim(argv: string[]): Promise<number> {
  const s = p.spinner()
  s.start('Checking for outdated packages')
  const json = npmJson<Record<string, OutdatedEntry | OutdatedEntry[]>>(['outdated'])
  const rows = parseOutdated(json)
  if (rows.length === 0) {
    s.stop('Everything is up to date')
    return 0
  }
  s.stop(`${rows.length} outdated · ${rows.filter((r) => r.major).length} major`)

  const target = await pick<'wanted' | 'latest'>('Update to', [
    { value: 'latest', label: 'latest', hint: 'newest published version, may be a major bump' },
    { value: 'wanted', label: 'wanted', hint: 'newest version within your package.json range' },
  ])
  const chosen = await pickMany(
    'Update',
    rows.map((r) => ({
      value: r.name,
      label: r.name,
      hint: `${r.current ?? 'missing'} → ${r[target]}${r.major && target === 'latest' ? pc.red(' major') : ''}${r.type !== 'prod' ? pc.dim(` ${r.type}`) : ''}`,
    })),
  )
  const plan = planUpdate(
    rows.filter((r) => chosen.includes(r.name)),
    target,
  )
  showCommand(plan)
  void argv
  return execNpm(plan)
}
