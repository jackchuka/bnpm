import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, test, vi } from 'vitest'
import { App, initialUiState, type AppResult } from '../../src/mine/app.tsx'
import { createStore, type MineSource } from '../../src/mine/store.ts'
import type { Packument } from '../../src/registry/packument.ts'

const doc = (name: string, latest: string, deprecated?: string): Packument => ({
  name,
  'dist-tags': { latest, next: '9.9.9-beta.0' },
  versions: {
    [latest]: { version: latest, ...(deprecated ? { deprecated } : {}) },
    '9.9.9-beta.0': { version: '9.9.9-beta.0' },
  },
  time: {
    created: '2025-01-01T00:00:00Z',
    [latest]: '2026-09-01T00:00:00Z',
    '9.9.9-beta.0': '2026-09-02T00:00:00Z',
  },
  maintainers: [{ name: 'me' }, { name: 'bob' }],
})

const source: MineSource = {
  whoami: async () => 'me',
  userPackages: async () => ({ '@t/sdk': 'write', '@t/core': 'write', '@t/legacy': 'write' }),
  packument: async (n) =>
    doc(n, n === '@t/legacy' ? '0.6.0' : '2.15.0', n === '@t/legacy' ? 'dead' : undefined),
  weekly: async (names) => new Map(names.map((n, i) => [n, (i + 1) * 1000])),
  range: async () => [1, 2, 3],
  visibility: async () => 'public',
}

const tick = () => new Promise((r) => setTimeout(r, 30))
const ENTER = '\r'
const ESC = ''

async function mount() {
  const store = createStore(source)
  await store.load()
  const onExit = vi.fn<(r: AppResult) => void>()
  const ui = render(<App store={store} state={initialUiState()} onExit={onExit} columns={100} />)
  await tick()
  return { ui, onExit, store }
}

async function press(ui: ReturnType<typeof render>, ...keys: string[]) {
  for (const k of keys) {
    ui.stdin.write(k)
    await tick()
  }
}

describe('mine App', () => {
  test.each(['whoami', 'userPackages'] as const)(
    'shows an initial %s failure after mounting',
    async (method) => {
      const store = createStore({
        ...source,
        [method]: async () => {
          throw new Error('authentication failed')
        },
      })
      const ui = render(<App store={store} state={initialUiState()} onExit={() => {}} />)
      await expect(store.load()).rejects.toThrow('authentication failed')
      await tick()
      expect(ui.lastFrame()).toContain('✗ authentication failed · r to retry')
      expect(ui.lastFrame()).toContain('unable to load packages')
      expect(ui.lastFrame()).not.toContain('loading…')
      ui.unmount()
    },
  )

  test('r reloads after an initial failure', async () => {
    let attempts = 0
    const store = createStore({
      ...source,
      whoami: async () => {
        if (attempts++ === 0) throw new Error('ETIMEDOUT')
        return 'me'
      },
    })
    const ui = render(<App store={store} state={initialUiState()} onExit={() => {}} />)
    await expect(store.load()).rejects.toThrow('ETIMEDOUT')
    await press(ui, 'r')
    expect(ui.lastFrame()).not.toContain('ETIMEDOUT')
    expect(ui.lastFrame()).toContain('@t/sdk')
    expect(ui.lastFrame()).toContain('· me ·')
    ui.unmount()
  })

  test('renders header, one row per package, and the detail pane', async () => {
    const { ui } = await mount()
    const frame = ui.lastFrame()!
    expect(frame).toContain('bnpm mine · me · 3 packages')
    expect(frame).toContain('@t/core')
    expect(frame).toContain('@t/sdk')
    expect(frame).toContain('@t/legacy')
    expect(frame).toContain('deprecated')
    expect(frame).toMatch(/2\.15\.0/)
    expect(frame).toContain('1.0k')
  })

  test('/ enters filter mode and narrows rows', async () => {
    const { ui } = await mount()
    await press(ui, '/', 'leg')
    const frame = ui.lastFrame()!
    expect(frame).toContain('@t/legacy')
    expect(frame).not.toContain('@t/core')
  })

  test('Enter opens the action menu for the highlighted package', async () => {
    const { ui } = await mount()
    await press(ui, ENTER)
    const frame = ui.lastFrame()!
    expect(frame).toContain('Deprecate')
    expect(frame).toContain('Unpublish')
    expect(frame).not.toContain('Undeprecate')
  })

  test('deprecate flow ends in a confirm showing the exact npm command, Enter emits run', async () => {
    const { ui, onExit } = await mount()
    await press(ui, ENTER, ENTER, ENTER, 'use sdk', ENTER)
    expect(ui.lastFrame()).toContain("npm deprecate @t/core 'use sdk'")
    await press(ui, ENTER)
    expect(onExit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'run',
        argv: ['deprecate', '@t/core', 'use sdk'],
        pkg: '@t/core',
      }),
    )
  })

  test('d on confirm emits a dry run', async () => {
    const { ui, onExit } = await mount()
    await press(ui, ENTER, ENTER, ENTER, 'bye', ENTER, 'd')
    expect(onExit.mock.calls[0]?.[0]).toMatchObject({
      kind: 'run',
      argv: ['deprecate', '@t/core', 'bye', '--dry-run'],
    })
  })

  test('Escape backs out of the menu; q quits', async () => {
    const { ui, onExit } = await mount()
    await press(ui, ENTER)
    expect(ui.lastFrame()).toContain('Deprecate')
    await press(ui, ESC)
    expect(ui.lastFrame()).not.toContain('Deprecate')
    await press(ui, 'q')
    expect(onExit).toHaveBeenCalledWith({ kind: 'quit' })
  })

  test('s cycles sort to published and shows it in the header', async () => {
    const { ui } = await mount()
    await press(ui, 's')
    expect(ui.lastFrame()).toContain('sort: published')
  })

  test('shows a loading marker while rows are still enriching', async () => {
    const slow: MineSource = { ...source, packument: () => new Promise(() => {}) }
    const store = createStore(slow)
    void store.load()
    await tick()
    const ui = render(
      <App store={store} state={initialUiState()} onExit={() => {}} columns={100} />,
    )
    await tick()
    expect(ui.lastFrame()).toContain('loading')
  })
})

describe('free-form entry in pick steps', () => {
  test('typing a range that matches no version offers it as a custom value', async () => {
    const { ui, onExit } = await mount()
    await press(ui, ENTER, ENTER, '<2.0.0')
    expect(ui.lastFrame()).toContain('use "<2.0.0"')
    await press(ui, ENTER, 'old', ENTER)
    expect(ui.lastFrame()).toContain("npm deprecate '@t/core@<2.0.0' old")
    await press(ui, ENTER)
    expect(onExit.mock.calls[0]?.[0]).toMatchObject({
      argv: ['deprecate', '@t/core@<2.0.0', 'old'],
    })
  })

  test('an invalid custom value shows the validation error and is not accepted', async () => {
    const { ui } = await mount()
    await press(ui, ENTER, ENTER, 'banana', ENTER)
    expect(ui.lastFrame()).toContain('not a valid semver range')
    expect(ui.lastFrame()).not.toContain('message')
  })
})

describe('custom entry ordering', () => {
  test('custom value is listed after matching choices so Enter prefers the match', async () => {
    const { ui } = await mount()
    await press(ui, ENTER, ENTER, '9.9')
    const frame = ui.lastFrame()!
    expect(frame.indexOf('9.9.9-beta.0')).toBeLessThan(frame.indexOf('use "9.9"'))
    expect(frame).toMatch(/▸ 9\.9\.9-beta\.0/)
  })
})

const unauthorized = () => {
  const err = new Error('401 Unauthorized - GET https://registry.npmjs.org/-/whoami')
  ;(err as Error & { statusCode: number }).statusCode = 401
  return err
}

describe('logging in from the error screen', () => {
  const deadSource = (err: () => Error): MineSource => ({
    ...source,
    whoami: async () => {
      throw err()
    },
  })

  test('offers login and exits with it when credentials are the problem', async () => {
    const store = createStore(deadSource(unauthorized))
    const onExit = vi.fn<(r: AppResult) => void>()
    const ui = render(<App store={store} state={initialUiState()} onExit={onExit} columns={100} />)
    await expect(store.load()).rejects.toThrow('401')
    await tick()
    expect(ui.lastFrame()).toContain('l to log in')
    expect(ui.lastFrame()).toContain('not logged in')
    ui.stdin.write('l')
    await tick()
    expect(onExit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'login' }))
    ui.unmount()
  })

  test('does not offer login for a failure credentials cannot fix', async () => {
    const store = createStore(deadSource(() => new Error('getaddrinfo ENOTFOUND registry')))
    const onExit = vi.fn<(r: AppResult) => void>()
    const ui = render(<App store={store} state={initialUiState()} onExit={onExit} columns={100} />)
    await expect(store.load()).rejects.toThrow('ENOTFOUND')
    await tick()
    expect(ui.lastFrame()).not.toContain('l to log in')
    expect(ui.lastFrame()).toContain('unable to load packages')
    ui.stdin.write('l')
    await tick()
    expect(onExit).not.toHaveBeenCalled()
    ui.unmount()
  })
})
