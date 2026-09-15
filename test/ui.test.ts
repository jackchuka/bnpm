import { describe, expect, test } from 'vitest'
import { matches, pickValidation } from '../src/ui/prompts.ts'

describe('matches', () => {
  test('empty search matches everything', () => expect(matches('', 'dev')).toBe(true))
  test('substring match, case-insensitive', () => expect(matches('TES', 'test')).toBe(true))
  test('subsequence match on label only', () => expect(matches('tst', 'test')).toBe(true))
  test('does not match when letters are out of order', () =>
    expect(matches('te', 'dev')).toBe(false))
  test('scoped package: "core" matches @scope/core-kit', () =>
    expect(matches('core', '@scope/core-kit')).toBe(true))
})

describe('pickValidation', () => {
  const v = pickValidation('user', (x) => x !== 'bob')
  test('nothing selected and nothing typed is rejected, not accepted as empty', () => {
    expect(v(undefined)).toBe('required')
    expect(v('')).toBe('required')
    expect(v('   ')).toBe('required')
  })
  test('an existing choice passes without custom validation', () =>
    expect(v('bob')).toBeUndefined())
  test('a custom value is validated for its kind', () => {
    expect(v('carol')).toBeUndefined()
    expect(v('not a user!')).toBe('not a valid username')
  })
})
