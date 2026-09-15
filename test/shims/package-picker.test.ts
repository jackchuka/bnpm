import { describe, expect, test } from 'vitest'
import { packageChoices } from '../../src/shims/package-picker.ts'

describe('packageChoices', () => {
  test('puts the current package first, marked as the npm default', () => {
    const choices = packageChoices({ '@s/b': 'write', '@s/a': 'write' }, 'my-app')
    expect(choices[0]).toEqual({
      value: 'my-app',
      label: 'my-app',
      hint: 'current package · npm default',
    })
    expect(choices.slice(1).map((c) => c.value)).toEqual(['@s/a', '@s/b'])
  })

  test('does not duplicate the current package when it is also yours', () => {
    const choices = packageChoices({ '@s/a': 'write' }, '@s/a')
    expect(choices.map((c) => c.value)).toEqual(['@s/a'])
    expect(choices[0]?.hint).toContain('current package')
  })

  test('marks read-only packages', () => {
    expect(packageChoices({ x: 'read' }, undefined)[0]?.hint).toBe('read-only')
  })
})

describe('packageChoices with project dependencies', () => {
  const deps = [
    { name: 'react', range: '^19.0.0', type: 'prod' as const },
    { name: 'vitest', range: '^5.0.0', type: 'dev' as const },
    { name: '@s/a', range: '^1.0.0', type: 'prod' as const },
  ]

  test('order is current package, project dependencies, then your published packages', () => {
    const choices = packageChoices({ '@s/a': 'write', '@s/z': 'write' }, 'my-app', deps)
    expect(choices.map((c) => c.value)).toEqual(['my-app', 'react', 'vitest', '@s/a', '@s/z'])
  })

  test('dependency hints show the range and dev type', () => {
    const choices = packageChoices({}, undefined, deps)
    expect(choices.find((c) => c.value === 'react')?.hint).toBe('^19.0.0')
    expect(choices.find((c) => c.value === 'vitest')?.hint).toBe('^5.0.0 dev')
  })

  test('a dependency that is also yours appears once, as a dependency', () => {
    const choices = packageChoices({ '@s/a': 'write' }, undefined, deps)
    expect(choices.filter((c) => c.value === '@s/a')).toHaveLength(1)
    expect(choices.find((c) => c.value === '@s/a')?.hint).toBe('^1.0.0')
  })
})
