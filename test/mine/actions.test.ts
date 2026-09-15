import { describe, expect, test } from 'vitest'
import { buildArgv, availableActions, type ActionRequest } from '../../src/mine/actions.ts'

describe('buildArgv', () => {
  test.each<[ActionRequest, string[]]>([
    [
      { kind: 'deprecate', pkg: '@s/a', version: '1.0.0', message: 'use b' },
      ['deprecate', '@s/a@1.0.0', 'use b'],
    ],
    [
      { kind: 'deprecate', pkg: '@s/a', version: '*', message: 'dead' },
      ['deprecate', '@s/a', 'dead'],
    ],
    [{ kind: 'undeprecate', pkg: '@s/a', version: '1.0.0' }, ['undeprecate', '@s/a@1.0.0']],
    [{ kind: 'undeprecate', pkg: '@s/a', version: '*' }, ['undeprecate', '@s/a']],
    [
      { kind: 'dist-tag-add', pkg: '@s/a', version: '2.0.0', tag: 'next' },
      ['dist-tag', 'add', '@s/a@2.0.0', 'next'],
    ],
    [{ kind: 'dist-tag-rm', pkg: '@s/a', tag: 'next' }, ['dist-tag', 'rm', '@s/a', 'next']],
    [{ kind: 'owner-add', pkg: '@s/a', user: 'bob' }, ['owner', 'add', 'bob', '@s/a']],
    [{ kind: 'owner-rm', pkg: '@s/a', user: 'bob' }, ['owner', 'rm', 'bob', '@s/a']],
    [{ kind: 'access', pkg: '@s/a', status: 'public' }, ['access', 'set', 'status=public', '@s/a']],
    [{ kind: 'unpublish', pkg: '@s/a', version: '1.0.0' }, ['unpublish', '@s/a@1.0.0']],
    [{ kind: 'unpublish', pkg: '@s/a', version: '*' }, ['unpublish', '@s/a', '--force']],
    [{ kind: 'view', pkg: '@s/a' }, ['view', '@s/a']],
  ])('%o', (req, argv) => expect(buildArgv(req)).toEqual(argv))

  test('dry-run appends --dry-run only where npm supports it: deprecate, undeprecate, unpublish', () => {
    expect(
      buildArgv({ kind: 'deprecate', pkg: 'a', version: '*', message: 'x' }, { dryRun: true }),
    ).toEqual(['deprecate', 'a', 'x', '--dry-run'])
    expect(buildArgv({ kind: 'undeprecate', pkg: 'a', version: '*' }, { dryRun: true })).toContain(
      '--dry-run',
    )
    expect(
      buildArgv({ kind: 'unpublish', pkg: 'a', version: '1.0.0' }, { dryRun: true }),
    ).toContain('--dry-run')
    expect(buildArgv({ kind: 'owner-add', pkg: 'a', user: 'b' }, { dryRun: true })).not.toContain(
      '--dry-run',
    )
    expect(buildArgv({ kind: 'view', pkg: 'a' }, { dryRun: true })).not.toContain('--dry-run')
  })

  test('pnpm has no --dry-run on any registry command, so none is added', () => {
    expect(
      buildArgv(
        { kind: 'deprecate', pkg: 'a', version: '*', message: 'x' },
        { dryRun: true, pm: 'pnpm' },
      ),
    ).not.toContain('--dry-run')
  })
})

describe('availableActions under pnpm', () => {
  test('owners and access stay when npm is installed to run them', () => {
    const kinds = availableActions({
      deprecatedCount: 0,
      access: 'write',
      pm: 'pnpm',
      npmAvailable: true,
    }).map((a) => a.kind)
    expect(kinds).toContain('owner')
    expect(kinds).toContain('access')
  })
  test('owners and access are hidden with pnpm alone, since pnpm cannot list owners or read access', () => {
    const kinds = availableActions({
      deprecatedCount: 0,
      access: 'write',
      pm: 'pnpm',
      npmAvailable: false,
    }).map((a) => a.kind)
    expect(kinds).not.toContain('owner')
    expect(kinds).not.toContain('access')
  })
})

describe('availableActions off npmjs', () => {
  test('open on npmjs.com is hidden for read and write access', () => {
    for (const access of ['read', 'write'] as const) {
      const kinds = availableActions({ deprecatedCount: 0, access, npmjs: false }).map(
        (a) => a.kind,
      )
      expect(kinds).not.toContain('open')
      expect(kinds).toContain('view')
    }
  })
})

describe('availableActions', () => {
  test('hides undeprecate when nothing is deprecated', () => {
    const kinds = availableActions({ deprecatedCount: 0, access: 'write' }).map((a) => a.kind)
    expect(kinds).not.toContain('undeprecate')
    expect(kinds).toContain('deprecate')
  })
  test('shows undeprecate when some version is deprecated', () => {
    expect(availableActions({ deprecatedCount: 2, access: 'write' }).map((a) => a.kind)).toContain(
      'undeprecate',
    )
  })
  test('read-only access gets view/open only', () => {
    expect(availableActions({ deprecatedCount: 0, access: 'read' }).map((a) => a.kind)).toEqual([
      'view',
      'open',
    ])
  })
  test('unpublish is last and marked destructive', () => {
    const acts = availableActions({ deprecatedCount: 0, access: 'write' })
    expect(acts.at(-1)).toMatchObject({ kind: 'unpublish', destructive: true })
  })
})
