import { describe, expect, test } from 'vitest'
import { flow, type Step } from '../../src/mine/flows.ts'
import { validateCustom } from '../../src/mine/validate.ts'
import type { MineRow } from '../../src/mine/rows.ts'

const row: MineRow = {
  name: '@s/a',
  access: 'write',
  status: 'loaded',
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
    ],
    created: '2026-01-01T00:00:00Z',
    lastPublished: '2026-01-03T00:00:00Z',
    deprecatedCount: 0,
    latestDeprecated: false,
    maintainers: ['me'],
    description: undefined,
  },
}

const first = (kind: Parameters<typeof flow>[0]) => flow(kind, row, 'me').next().value as Step

describe('free-form steps', () => {
  test('version pick allows a custom range', () => {
    const step = first('deprecate')
    expect(step).toMatchObject({ type: 'pick', title: 'version', allowCustom: 'range' })
  })

  test('dist-tag add offers existing tags and allows a new one', () => {
    const g = flow('dist-tag', row, 'me')
    g.next()
    g.next('add')
    const tagStep = g.next('2.0.0').value as Step
    expect(tagStep).toMatchObject({ type: 'pick', title: 'tag', allowCustom: 'tag' })
    expect((tagStep as Extract<Step, { type: 'pick' }>).choices.map((c) => c.value)).toEqual([
      'next',
    ])
    expect(g.next('stable').value).toEqual({
      kind: 'dist-tag-add',
      pkg: '@s/a',
      version: '2.0.0',
      tag: 'stable',
    })
  })

  test('a custom range flows through to the deprecate request', () => {
    const g = flow('deprecate', row, 'me')
    g.next()
    g.next('<2.0.0')
    expect(g.next('old').value).toEqual({
      kind: 'deprecate',
      pkg: '@s/a',
      version: '<2.0.0',
      message: 'old',
    })
  })
})

describe('validateCustom', () => {
  test.each([
    ['range', '<2.0.0', undefined],
    ['range', '1.x', undefined],
    ['range', 'banana', 'not a valid semver range'],
    ['version', '1.2.3', undefined],
    ['version', '1.2', 'not a valid version'],
    ['tag', 'next', undefined],
    ['tag', '1.2.3', 'a tag cannot look like a version'],
    ['tag', 'has space', 'not a valid tag name'],
    ['package', '@scope/name', undefined],
    ['package', 'React', 'not a valid package name'],
    ['package', '', 'required'],
  ] as const)('%s %j → %s', (kind, value, expected) => {
    expect(validateCustom(kind, value)).toBe(expected)
  })
})
