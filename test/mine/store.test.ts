import { describe, expect, test } from 'vitest'
import { createStore, type MineSource } from '../../src/mine/store.ts'
import type { Packument } from '../../src/registry/packument.ts'

const doc = (name: string, latest = '1.0.0', deprecated?: string): Packument => ({
  name,
  'dist-tags': { latest },
  versions: { [latest]: { version: latest, ...(deprecated ? { deprecated } : {}) } },
  time: { created: '2025-01-01T00:00:00Z', [latest]: '2025-02-01T00:00:00Z' },
  maintainers: [{ name: 'me' }],
})

function fakeSource(overrides: Partial<MineSource> = {}): MineSource & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    whoami: async () => 'me',
    userPackages: async () => ({ '@s/a': 'write', '@s/b': 'write', c: 'read' }),
    packument: async (name) => {
      calls.push(`packument:${name}`)
      if (name === '@s/b') throw new Error('404 not found')
      return doc(name, name === 'c' ? '3.0.0' : '1.0.0', name === 'c' ? 'dead' : undefined)
    },
    weekly: async (names) => new Map(names.map((n) => [n, n.length])),
    range: async () => [1, 2, 3],
    visibility: async () => 'private',
    ...overrides,
  }
}

describe('createStore', () => {
  test('load() lists packages immediately, then enriches them', async () => {
    const src = fakeSource()
    const store = createStore(src)
    const snapshots: string[] = []
    store.subscribe(() => snapshots.push(store.rows.map((r) => `${r.name}:${r.status}`).join(',')))
    await store.load()
    expect(store.user).toBe('me')
    expect(snapshots[0]).toBe('@s/a:loading,@s/b:loading,c:loading')
    const a = store.rows.find((r) => r.name === '@s/a')!
    expect(a).toMatchObject({
      status: 'loaded',
      latest: '1.0.0',
      weekly: 4,
      access: 'write',
      tagCount: 1,
    })
    const c = store.rows.find((r) => r.name === 'c')!
    expect(c).toMatchObject({ latestDeprecated: true, deprecatedCount: 1, access: 'read' })
  })

  test('a failing packument marks that row as error without blocking others', async () => {
    const store = createStore(fakeSource())
    await store.load()
    const b = store.rows.find((r) => r.name === '@s/b')!
    expect(b.status).toBe('error')
    expect(b.error).toMatch(/404/)
    expect(store.rows.filter((r) => r.status === 'loaded')).toHaveLength(2)
  })

  test('refresh(name) refetches only that package', async () => {
    const src = fakeSource()
    const store = createStore(src)
    await store.load()
    src.calls.length = 0
    await store.refresh('@s/a')
    expect(src.calls).toEqual(['packument:@s/a'])
  })

  test('loadRange(name) caches the 30-day series on the row', async () => {
    const store = createStore(fakeSource())
    await store.load()
    await store.loadRange('@s/a')
    expect(store.rows.find((r) => r.name === '@s/a')!.range).toEqual([1, 2, 3])
  })

  test('load() with no packages yields an empty list and no enrich calls', async () => {
    const src = fakeSource({ userPackages: async () => ({}) })
    const store = createStore(src)
    await store.load()
    expect(store.rows).toEqual([])
    expect(src.calls).toEqual([])
  })
})

describe('downloads failures', () => {
  test('a failing downloads API sets downloadsError and retryDownloads clears it on success', async () => {
    let fail = true
    const src = fakeSource({
      weekly: async (names) => {
        const m = new Map<string, number>(fail ? [] : names.map((n) => [n, 7]))
        return fail ? Object.assign(m, { error: '429 Too Many Requests' }) : m
      },
    })
    const store = createStore(src)
    await store.load()
    expect(store.downloadsError).toMatch(/429/)
    expect(store.rows[0]!.weekly).toBeUndefined()
    fail = false
    await store.retryDownloads()
    expect(store.downloadsError).toBeUndefined()
    expect(store.rows[0]!.weekly).toBe(7)
  })
})

describe('loadVisibility', () => {
  test('fetches and caches the visibility on the row', async () => {
    const store = createStore(fakeSource())
    await store.load()
    await store.loadVisibility('@s/a')
    expect(store.rows.find((r) => r.name === '@s/a')!.visibility).toBe('private')
  })
  test('a failure leaves visibility unknown', async () => {
    const store = createStore(fakeSource({ visibility: () => Promise.reject(new Error('401')) }))
    await store.load()
    await store.loadVisibility('@s/a')
    expect(store.rows.find((r) => r.name === '@s/a')!.visibility).toBeUndefined()
  })
})

describe('loadRange failures', () => {
  test('a failed range fetch leaves range undefined so it can be retried', async () => {
    const store = createStore(fakeSource({ range: () => Promise.reject(new Error('503')) }))
    await store.load()
    await store.loadRange('@s/a')
    expect(store.rows.find((r) => r.name === '@s/a')!.range).toBeUndefined()
  })
})

const unauthorized = () => {
  const err = new Error('401 Unauthorized - GET https://registry.npmjs.org/-/whoami')
  ;(err as Error & { statusCode: number }).statusCode = 401
  return err
}

describe('authFailed', () => {
  test('a 401 on whoami marks the load as an auth failure', async () => {
    const store = createStore(
      fakeSource({
        whoami: async () => {
          throw unauthorized()
        },
      }),
    )
    await expect(store.load()).rejects.toThrow('401')
    expect(store.authFailed).toBe(true)
    expect(store.loadError).toContain('401')
  })

  test('a failure that is not about credentials does not offer login', async () => {
    const store = createStore(
      fakeSource({
        whoami: async () => {
          throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org')
        },
      }),
    )
    await expect(store.load()).rejects.toThrow('ENOTFOUND')
    expect(store.authFailed).toBe(false)
  })

  test('a later successful load clears the flag', async () => {
    let first = true
    const store = createStore(
      fakeSource({
        whoami: async () => {
          if (first) {
            first = false
            throw unauthorized()
          }
          return 'me'
        },
      }),
    )
    await expect(store.load()).rejects.toThrow('401')
    expect(store.authFailed).toBe(true)
    await store.load()
    expect(store.authFailed).toBe(false)
    expect(store.loadError).toBeUndefined()
  })
})
