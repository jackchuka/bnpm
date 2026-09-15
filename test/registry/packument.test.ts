import { describe, expect, test } from 'vitest'
import { summarize, type Packument } from '../../src/registry/packument.ts'

const doc: Packument = {
  name: '@scope/pkg',
  'dist-tags': { latest: '2.0.0', next: '3.0.0-beta.1', legacy: '1.5.0' },
  versions: {
    '1.5.0': { version: '1.5.0', deprecated: 'use 2.x' },
    '2.0.0': { version: '2.0.0' },
    '3.0.0-beta.1': { version: '3.0.0-beta.1' },
  },
  time: {
    created: '2024-01-01T00:00:00.000Z',
    modified: '2025-06-01T00:00:00.000Z',
    '1.5.0': '2024-01-01T00:00:00.000Z',
    '2.0.0': '2025-03-01T00:00:00.000Z',
    '3.0.0-beta.1': '2025-06-01T00:00:00.000Z',
  },
  maintainers: [{ name: 'me', email: 'me@x' }, { name: 'bot' }],
}

describe('summarize', () => {
  const s = summarize(doc)

  test('exposes latest and dist-tags', () => {
    expect(s.latest).toBe('2.0.0')
    expect(s.distTags).toEqual({ latest: '2.0.0', next: '3.0.0-beta.1', legacy: '1.5.0' })
  })

  test('lists versions newest first with tag, time, and deprecation', () => {
    expect(s.versions.map((v) => v.version)).toEqual(['3.0.0-beta.1', '2.0.0', '1.5.0'])
    expect(s.versions[2]).toEqual({
      version: '1.5.0',
      time: '2024-01-01T00:00:00.000Z',
      tags: ['legacy'],
      deprecated: 'use 2.x',
    })
    expect(s.versions[0]?.tags).toEqual(['next'])
  })

  test('lastPublished is the newest version time, not time.modified', () => {
    expect(s.lastPublished).toBe('2025-06-01T00:00:00.000Z')
    expect(s.created).toBe('2024-01-01T00:00:00.000Z')
  })

  test('counts deprecated versions and flags when latest is deprecated', () => {
    expect(s.deprecatedCount).toBe(1)
    expect(s.latestDeprecated).toBe(false)
  })

  test('lists maintainer names', () => {
    expect(s.maintainers).toEqual(['me', 'bot'])
  })

  test('handles a packument with no versions (fully unpublished)', () => {
    const empty = summarize({ name: 'x', 'dist-tags': {}, versions: {}, time: {} })
    expect(empty.latest).toBeUndefined()
    expect(empty.versions).toEqual([])
    expect(empty.lastPublished).toBeUndefined()
  })
})
