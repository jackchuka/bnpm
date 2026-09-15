import { describe, expect, test } from 'vitest'
import { flow, type Step } from '../../src/mine/flows.ts'
import type { MineRow } from '../../src/mine/rows.ts'

const row: MineRow = {
  name: '@s/a',
  access: 'write',
  status: 'loaded',
  latest: '2.0.0',
  summary: {
    name: '@s/a',
    latest: '2.0.0',
    distTags: { latest: '2.0.0', next: '3.0.0-beta.1' },
    versions: [
      {
        version: '3.0.0-beta.1',
        time: '2026-01-03T00:00:00Z',
        tags: ['next'],
        deprecated: undefined,
      },
      { version: '2.0.0', time: '2026-01-02T00:00:00Z', tags: ['latest'], deprecated: undefined },
      { version: '1.0.0', time: '2026-01-01T00:00:00Z', tags: [], deprecated: 'old' },
    ],
    created: '2026-01-01T00:00:00Z',
    lastPublished: '2026-01-03T00:00:00Z',
    deprecatedCount: 1,
    latestDeprecated: false,
    maintainers: ['me', 'bob'],
    description: undefined,
  },
}

function drive(kind: Parameters<typeof flow>[0], answers: string[], r: MineRow = row) {
  const g = flow(kind, r, 'me')
  const steps: Step[] = []
  let next = g.next()
  for (const a of answers) {
    if (next.done) break
    steps.push(next.value)
    next = g.next(a)
  }
  if (!next.done) steps.push(next.value)
  return { steps, result: next.done ? next.value : undefined }
}

describe('flow', () => {
  test('deprecate: pick version → message → request', () => {
    const { steps, result } = drive('deprecate', ['1.0.0', 'use 2.x'])
    expect(steps[0]).toMatchObject({ type: 'pick', title: 'version' })
    expect((steps[0] as Extract<Step, { type: 'pick' }>).choices.map((c) => c.value)).toEqual([
      '*',
      '3.0.0-beta.1',
      '2.0.0',
      '1.0.0',
    ])
    expect(steps[1]).toMatchObject({ type: 'text', title: 'message', required: true })
    expect(result).toEqual({ kind: 'deprecate', pkg: '@s/a', version: '1.0.0', message: 'use 2.x' })
  })

  test('undeprecate offers only deprecated versions plus all', () => {
    const { steps, result } = drive('undeprecate', ['1.0.0'])
    expect((steps[0] as Extract<Step, { type: 'pick' }>).choices.map((c) => c.value)).toEqual([
      '*',
      '1.0.0',
    ])
    expect(result).toEqual({ kind: 'undeprecate', pkg: '@s/a', version: '1.0.0' })
  })

  test('dist-tag add: mode → version → tag', () => {
    const { result } = drive('dist-tag', ['add', '2.0.0', 'stable'])
    expect(result).toEqual({ kind: 'dist-tag-add', pkg: '@s/a', version: '2.0.0', tag: 'stable' })
  })

  test('dist-tag rm: mode → existing tag (latest excluded)', () => {
    const { steps, result } = drive('dist-tag', ['rm', 'next'])
    expect((steps[1] as Extract<Step, { type: 'pick' }>).choices.map((c) => c.value)).toEqual([
      'next',
    ])
    expect(result).toEqual({ kind: 'dist-tag-rm', pkg: '@s/a', tag: 'next' })
  })

  test('owner step shows the current owners in its title and hides rm when you are the only one', () => {
    const { steps } = drive('owner', ['add'])
    const step = steps[0] as Extract<Step, { type: 'pick' }>
    expect(step.title).toBe('owners (currently me, bob)')
    expect(step.choices.map((c) => c.value)).toEqual(['add', 'rm'])
    const solo = { ...row, summary: { ...row.summary!, maintainers: ['me'] } }
    const only = drive('owner', ['add'], solo).steps[0] as Extract<Step, { type: 'pick' }>
    expect(only.title).toBe('owners (currently me)')
    expect(only.choices.map((c) => c.value)).toEqual(['add'])
  })

  test('owner rm offers other maintainers, not yourself', () => {
    const { steps, result } = drive('owner', ['rm', 'bob'])
    expect((steps[1] as Extract<Step, { type: 'pick' }>).choices.map((c) => c.value)).toEqual([
      'bob',
    ])
    expect(result).toEqual({ kind: 'owner-rm', pkg: '@s/a', user: 'bob' })
  })

  test('owner add asks for a username', () => {
    expect(drive('owner', ['add', 'carol']).result).toEqual({
      kind: 'owner-add',
      pkg: '@s/a',
      user: 'carol',
    })
  })

  test('access shows the current status and asks for the other', () => {
    const { steps, result } = drive('access', ['private'], { ...row, visibility: 'public' })
    const step = steps[0] as Extract<Step, { type: 'pick' }>
    expect(step.title).toBe('access (currently public)')
    expect(step.choices.map((c) => [c.value, c.hint])).toEqual([
      ['private', 'requires a paid org/scope'],
      ['public', 'current'],
    ])
    expect(result).toEqual({ kind: 'access', pkg: '@s/a', status: 'private' })
  })

  test('access: choosing the current status cancels instead of running a no-op', () => {
    expect(drive('access', ['public'], { ...row, visibility: 'public' }).result).toBeNull()
  })

  test('access without a known status keeps public first and no title suffix', () => {
    const { steps } = drive('access', ['private'])
    expect((steps[0] as Extract<Step, { type: 'pick' }>).title).toBe('access')
  })

  test('unpublish: version → typed confirmation of the package name', () => {
    const { steps, result } = drive('unpublish', ['*', '@s/a'])
    expect(steps[1]).toMatchObject({ type: 'typed', expected: '@s/a' })
    expect(result).toEqual({ kind: 'unpublish', pkg: '@s/a', version: '*' })
  })

  test('view needs no steps', () => {
    expect(drive('view', []).result).toEqual({ kind: 'view', pkg: '@s/a' })
  })

  test('a preset version skips the version step', () => {
    const g = flow('deprecate', row, 'me', { version: '2.0.0' })
    const first = g.next()
    expect(first.value).toMatchObject({ type: 'text', title: 'message' })
    expect(g.next('bye').value).toEqual({
      kind: 'deprecate',
      pkg: '@s/a',
      version: '2.0.0',
      message: 'bye',
    })
  })
})
