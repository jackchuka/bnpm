import { describe, expect, test } from 'vitest'
import { timeAgo, formatCount, sparkline } from '../../src/mine/format.ts'

const now = new Date('2026-09-14T12:00:00Z')

describe('timeAgo', () => {
  test.each([
    ['2026-09-14T11:59:30Z', 'just now'],
    ['2026-09-14T11:30:00Z', '30m ago'],
    ['2026-09-14T09:00:00Z', '3h ago'],
    ['2026-09-12T12:00:00Z', '2d ago'],
    ['2026-08-24T12:00:00Z', '3w ago'],
    ['2026-06-14T12:00:00Z', '3mo ago'],
    ['2024-09-14T12:00:00Z', '2y ago'],
  ])('%s → %s', (iso, expected) => expect(timeAgo(iso, now)).toBe(expected))
  test('undefined → "—"', () => expect(timeAgo(undefined, now)).toBe('—'))
})

describe('formatCount', () => {
  test.each([
    [0, '0'],
    [999, '999'],
    [1000, '1.0k'],
    [5223, '5.2k'],
    [22461, '22k'],
    [1_200_000, '1.2M'],
    [undefined, '?'],
  ])('%s → %s', (n, expected) => expect(formatCount(n)).toBe(expected))
})

describe('sparkline', () => {
  test('maps values to 8 block heights', () => {
    expect(sparkline([0, 1, 2, 3, 4, 5, 6, 7])).toBe('▁▂▃▄▅▆▇█')
  })
  test('flat series renders as low bars', () => expect(sparkline([3, 3, 3])).toBe('▁▁▁'))
  test('empty series renders empty', () => expect(sparkline([])).toBe(''))
})
