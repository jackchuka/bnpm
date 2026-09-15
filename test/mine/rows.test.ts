import { describe, expect, test } from 'vitest'
import { sortRows, filterRows, type MineRow } from '../../src/mine/rows.ts'

const row = (name: string, extra: Partial<MineRow> = {}): MineRow => ({
  name,
  access: 'write',
  status: 'loaded',
  ...extra,
})

const rows = [
  row('@s/b', { lastPublished: '2026-01-01', weekly: 10 }),
  row('@s/a', { lastPublished: '2026-03-01', weekly: 500, latestDeprecated: true }),
  row('zed', { lastPublished: undefined, weekly: undefined }),
]

describe('sortRows', () => {
  test('by name ascending', () =>
    expect(sortRows(rows, 'name').map((r) => r.name)).toEqual(['@s/a', '@s/b', 'zed']))
  test('by published, newest first, unknown last', () =>
    expect(sortRows(rows, 'published').map((r) => r.name)).toEqual(['@s/a', '@s/b', 'zed']))
  test('by downloads descending, unknown last', () =>
    expect(sortRows(rows, 'downloads').map((r) => r.name)).toEqual(['@s/a', '@s/b', 'zed']))
  test('deprecated first, then by name', () =>
    expect(sortRows(rows, 'deprecated').map((r) => r.name)).toEqual(['@s/a', '@s/b', 'zed']))
  test('does not mutate input', () => {
    const copy = [...rows]
    sortRows(rows, 'name')
    expect(rows).toEqual(copy)
  })
})

describe('filterRows', () => {
  test('matches on name with substring or subsequence', () => {
    expect(filterRows(rows, 's/a').map((r) => r.name)).toEqual(['@s/a'])
    expect(filterRows(rows, 'zd').map((r) => r.name)).toEqual(['zed'])
  })
  test('empty query returns all', () => expect(filterRows(rows, '')).toHaveLength(3))
})
