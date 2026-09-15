import { describe, expect, test } from 'vitest'
import { planRun } from '../../src/shims/run.ts'
import { planUninstall, removable } from '../../src/shims/uninstall.ts'
import { planUpdate, parseOutdated } from '../../src/shims/update.ts'

describe('planRun', () => {
  test('builds npm run argv for the chosen script', () => {
    expect(planRun('test')).toEqual(['run', 'test'])
  })
})

describe('planUninstall', () => {
  test('builds npm uninstall argv for chosen packages', () => {
    expect(planUninstall(['lodash', 'left-pad'])).toEqual(['uninstall', 'lodash', 'left-pad'])
  })
})

describe('removable', () => {
  const deps = [
    { name: 'react', range: '^19', type: 'prod' as const },
    { name: 'vitest', range: '^3', type: 'dev' as const },
    { name: 'fsevents', range: '^2', type: 'optional' as const },
    { name: 'typescript', range: '^5', type: 'peer' as const },
  ]

  test('npm uninstall accepts every dependency type', () => {
    expect(removable(deps, 'npm')).toEqual(deps)
  })

  test('pnpm remove rejects peers (ERR_PNPM_CANNOT_REMOVE_MISSING_DEPS), so they are hidden', () => {
    expect(removable(deps, 'pnpm').map((d) => d.name)).toEqual(['react', 'vitest', 'fsevents'])
  })
})

describe('parseOutdated', () => {
  test('flattens npm outdated --json into rows with major flag', () => {
    const json = {
      vite: {
        current: '5.4.0',
        wanted: '5.4.11',
        latest: '6.0.1',
        dependent: 'proj',
        location: '/x',
        type: 'devDependencies',
      },
      zod: {
        current: '3.23.8',
        wanted: '3.24.1',
        latest: '3.24.1',
        dependent: 'proj',
        location: '/x',
        type: 'dependencies',
      },
    }
    expect(parseOutdated(json)).toEqual([
      {
        name: 'vite',
        current: '5.4.0',
        wanted: '5.4.11',
        latest: '6.0.1',
        type: 'dev',
        major: true,
      },
      {
        name: 'zod',
        current: '3.23.8',
        wanted: '3.24.1',
        latest: '3.24.1',
        type: 'prod',
        major: false,
      },
    ])
  })

  test('handles the array form npm emits for duplicated packages', () => {
    const json = {
      a: [{ current: '1.0.0', wanted: '1.1.0', latest: '2.0.0', type: 'dependencies' }],
    }
    expect(parseOutdated(json)).toHaveLength(1)
  })

  test('treats missing current (not installed) as not major', () => {
    const json = { a: { wanted: '1.1.0', latest: '2.0.0', type: 'dependencies' } }
    expect(parseOutdated(json)[0]).toMatchObject({ current: undefined, major: false })
  })
})

describe('planUpdate', () => {
  const rows = [
    {
      name: 'vite',
      current: '5.4.0',
      wanted: '5.4.11',
      latest: '6.0.1',
      type: 'dev' as const,
      major: true,
    },
    {
      name: 'zod',
      current: '3.23.8',
      wanted: '3.24.1',
      latest: '3.24.1',
      type: 'prod' as const,
      major: false,
    },
  ]
  test('installs chosen packages at latest', () => {
    expect(planUpdate(rows, 'latest')).toEqual(['install', 'vite@6.0.1', 'zod@3.24.1'])
  })
  test('installs chosen packages at wanted', () => {
    expect(planUpdate(rows, 'wanted')).toEqual(['install', 'vite@5.4.11', 'zod@3.24.1'])
  })
})
