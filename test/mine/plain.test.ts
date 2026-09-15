import { describe, expect, test } from 'vitest'
import { renderPlain } from '../../src/mine/plain.ts'
import type { MineRow } from '../../src/mine/rows.ts'

const rows: MineRow[] = [
  {
    name: '@s/a',
    access: 'write',
    status: 'loaded',
    latest: '2.0.0',
    tagCount: 2,
    lastPublished: '2026-09-12T12:00:00Z',
    weekly: 5223,
    latestDeprecated: false,
  },
  {
    name: 'b',
    access: 'read',
    status: 'loaded',
    latest: '0.1.0',
    tagCount: 1,
    lastPublished: '2026-08-01T12:00:00Z',
    weekly: 3,
    latestDeprecated: true,
  },
]

describe('renderPlain', () => {
  test('tab-separated rows with a header', () => {
    const out = renderPlain(rows, new Date('2026-09-14T12:00:00Z'))
    expect(out.split('\n')[0]).toBe('PACKAGE\tLATEST\tTAGS\tPUBLISHED\tDOWNLOADS/WK\tSTATUS')
    expect(out.split('\n')[1]).toBe('@s/a\t2.0.0\t2\t2d ago\t5.2k\t')
    expect(out.split('\n')[2]).toBe('b\t0.1.0\t1\t6w ago\t3\tdeprecated')
  })
})
