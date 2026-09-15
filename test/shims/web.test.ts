import { describe, expect, test, vi } from 'vitest'
import type { Registry } from '../../src/registry/client.ts'
import { viewTargets, pickPackage, planOpen, OPEN_SHIMS } from '../../src/shims/web.ts'
import { pickOrType } from '../../src/ui/prompts.ts'

vi.mock('../../src/ui/prompts.ts', () => ({
  p: { spinner: () => ({ start: vi.fn(), stop: vi.fn() }), log: { info: vi.fn() } },
  pickOrType: vi.fn(async () => 'typed-package'),
}))
vi.mock('../../src/pkgjson.ts', async (original) => ({
  ...(await original<typeof import('../../src/pkgjson.ts')>()),
  readPackageJson: () => ({ name: 'local-package', dependencies: { lodash: '^4' } }),
}))

describe('viewTargets', () => {
  test('terminal view is first, then npmjs.com, repository, homepage', () => {
    expect(viewTargets(true).map((t) => t.value)).toEqual(['terminal', 'npmjs', 'repo', 'docs'])
  })
  test('npmjs.com is not offered against another registry', () => {
    expect(viewTargets(false).map((t) => t.value)).toEqual(['terminal', 'repo', 'docs'])
  })
})

describe('planOpen', () => {
  test('maps targets to the active manager command', () => {
    expect(planOpen('repo', '@s/a', 'npm')).toEqual({ pm: 'npm', argv: ['repo', '@s/a'] })
    expect(planOpen('docs', '@s/a', 'pnpm')).toEqual({ pm: 'pnpm', argv: ['docs', '@s/a'] })
    expect(planOpen('bugs', '@s/a', 'pnpm')).toEqual({ pm: 'pnpm', argv: ['bugs', '@s/a'] })
    expect(planOpen('terminal', '@s/a', 'npm')).toEqual({ pm: 'npm', argv: ['view', '@s/a'] })
  })
  test('npmjs is not a manager command', () => {
    expect(planOpen('npmjs', '@s/a', 'npm')).toEqual({
      url: 'https://www.npmjs.com/package/@s/a',
    })
  })
})

describe('OPEN_SHIMS', () => {
  test('docs/home, repo, and bugs/issues map to their target', () => {
    expect(OPEN_SHIMS.docs).toBe('docs')
    expect(OPEN_SHIMS.home).toBe('docs')
    expect(OPEN_SHIMS.repo).toBe('repo')
    expect(OPEN_SHIMS.bugs).toBe('bugs')
    expect(OPEN_SHIMS.issues).toBe('bugs')
  })
})

describe('pickPackage', () => {
  test.each(['whoami', 'userPackages'] as const)(
    'keeps local choices and custom input when %s fails',
    async (method) => {
      const registry: Registry = {
        flat: { registry: 'https://registry.npmjs.org/' },
        whoami: async () => 'me',
        userPackages: async () => ({}),
        packument: vi.fn(),
        visibility: vi.fn(),
        [method]: async () => {
          throw new Error('unauthorized')
        },
      }
      expect(await pickPackage('View', registry)).toBe('typed-package')
      expect(pickOrType).toHaveBeenLastCalledWith(
        'View',
        [
          expect.objectContaining({ value: 'local-package' }),
          expect.objectContaining({ value: 'lodash' }),
        ],
        'package',
      )
    },
  )
})
