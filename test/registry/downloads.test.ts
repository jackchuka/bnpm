import { describe, expect, test } from 'vitest'
import { weeklyDownloads, rangeDownloads, batches } from '../../src/registry/downloads.ts'

describe('batches', () => {
  test('scoped packages go one per request, unscoped are grouped up to 128', () => {
    const names = ['@a/x', 'lodash', '@b/y', 'react']
    expect(batches(names)).toEqual([['@a/x'], ['@b/y'], ['lodash', 'react']])
  })

  test('splits unscoped groups at 128', () => {
    const names = Array.from({ length: 130 }, (_, i) => `p${i}`)
    const b = batches(names)
    expect(b.map((x) => x.length)).toEqual([128, 2])
  })
})

describe('weeklyDownloads', () => {
  test('parses a single unscoped package', async () => {
    const result = await weeklyDownloads(['lodash'], async () => ({
      downloads: 123,
      package: 'lodash',
    }))
    expect(result.get('lodash')).toBe(123)
  })

  test('a package without stats counts as zero rather than an error', async () => {
    const result = await weeklyDownloads(['@s/private'], async () => null)
    expect(result.get('@s/private')).toBe(0)
    expect(result.error).toBeUndefined()
  })

  test('parses the single package left after a full batch', async () => {
    const names = Array.from({ length: 129 }, (_, i) => `p${i}`)
    const result = await weeklyDownloads(names, async (url) => {
      const group = url.split('/').at(-1)!.split(',')
      return group.length === 1
        ? { downloads: 123, package: group[0] }
        : Object.fromEntries(group.map((name) => [name, { downloads: 7, package: name }]))
    })
    expect(result.get('p128')).toBe(123)
    expect(result.get('p0')).toBe(7)
  })

  test('parses single and bulk responses into a name→count map', async () => {
    const calls: string[] = []
    const fetchJson = async (url: string) => {
      calls.push(url)
      if (url.endsWith('/@a/x')) return { downloads: 5, package: '@a/x' }
      return {
        lodash: { downloads: 100, package: 'lodash' },
        react: null,
      }
    }
    const r = await weeklyDownloads(['@a/x', 'lodash', 'react'], fetchJson)
    expect(r).toEqual(
      new Map([
        ['@a/x', 5],
        ['lodash', 100],
        ['react', 0],
      ]),
    )
    expect(calls).toEqual([
      'https://api.npmjs.org/downloads/point/last-week/@a/x',
      'https://api.npmjs.org/downloads/point/last-week/lodash,react',
    ])
  })

  test('a failed request yields undefined counts and reports the reason', async () => {
    const r = await weeklyDownloads(['lodash'], () =>
      Promise.reject(new Error('429 Too Many Requests')),
    )
    expect(r.get('lodash')).toBeUndefined()
    expect(r.error).toMatch(/429/)
  })

  test('a 429 is explained as rate limiting', async () => {
    const r = await weeklyDownloads(['lodash'], () =>
      Promise.reject(new Error('429 https://api.npmjs.org/x')),
    )
    expect(r.error).toBe('rate limited by api.npmjs.org (429), try again in a minute')
  })

  test('no error is reported when every request succeeds', async () => {
    const r = await weeklyDownloads(['lodash'], async () => ({
      downloads: 1,
      package: 'lodash',
    }))
    expect(r.error).toBeUndefined()
  })
})

describe('rangeDownloads', () => {
  test('returns daily counts in order', async () => {
    const json = {
      downloads: [
        { day: '2026-08-01', downloads: 1 },
        { day: '2026-08-02', downloads: 2 },
      ],
    }
    expect(await rangeDownloads('x', () => Promise.resolve(json))).toEqual([1, 2])
  })
})
