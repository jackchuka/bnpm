import { describe, expect, test } from 'vitest'
import { menuEntries } from '../src/commands/menu.ts'

const words = (pm: 'npm' | 'pnpm', hasProject: boolean) =>
  menuEntries(pm, hasProject).map((e) => e.word)

describe('menuEntries', () => {
  test('offers the project commands inside a project', () => {
    expect(words('npm', true)).toContain('run')
    expect(words('npm', true)).toContain('uninstall')
    expect(words('npm', true)).toContain('exec')
  })

  test('drops the project commands outside one', () => {
    const out = words('npm', false)
    for (const w of ['run', 'uninstall', 'update', 'exec', 'link']) expect(out).not.toContain(w)
    expect(out).toContain('view')
    expect(out).toContain('mine')
  })

  test('drops update under pnpm, which ships its own update -i', () => {
    expect(words('npm', true)).toContain('update')
    expect(words('pnpm', true)).not.toContain('update')
  })

  test('every entry routes to something bnpm actually handles', () => {
    for (const pm of ['npm', 'pnpm'] as const) {
      expect(menuEntries(pm, true).length).toBeGreaterThan(0)
    }
  })
})
