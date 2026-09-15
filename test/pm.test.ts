import { describe, expect, test } from 'vitest'
import { resolvePm, commandLine } from '../src/pm.ts'
import { managerFor } from '../src/mine/actions.ts'

describe('resolvePm', () => {
  test('defaults to npm and leaves argv alone', () => {
    expect(resolvePm(['run', 'x'], {})).toEqual({ pm: 'npm', argv: ['run', 'x'] })
  })
  test('uses the detected project manager when no flag or env is given', () => {
    expect(resolvePm(['run'], {}, () => 'pnpm').pm).toBe('pnpm')
    expect(resolvePm(['run'], {}, () => undefined).pm).toBe('npm')
  })
  test('env beats detection, flag beats env', () => {
    expect(resolvePm(['run'], { BNPM_PM: 'npm' }, () => 'pnpm').pm).toBe('npm')
    expect(resolvePm(['--pm=pnpm', 'run'], { BNPM_PM: 'npm' }, () => undefined).pm).toBe('pnpm')
  })
  test('--pm=pnpm as the first arg (how the alias passes it) is consumed', () => {
    expect(resolvePm(['--pm=pnpm', 'install', 'zod'], {})).toEqual({
      pm: 'pnpm',
      argv: ['install', 'zod'],
    })
  })
  test('--pm pnpm with a space works too', () => {
    expect(resolvePm(['--pm', 'pnpm', 'run'], {})).toEqual({ pm: 'pnpm', argv: ['run'] })
  })
  test('BNPM_PM env is the fallback', () => {
    expect(resolvePm(['run'], { BNPM_PM: 'pnpm' }).pm).toBe('pnpm')
  })
  test('the flag beats the env', () => {
    expect(resolvePm(['--pm=npm', 'run'], { BNPM_PM: 'pnpm' }).pm).toBe('npm')
  })
  test('unknown manager is an error naming the valid ones', () => {
    expect(() => resolvePm(['--pm=yarn'], {})).toThrow(/npm, pnpm/)
  })
  test('a later --pm belongs to the package manager and is not consumed', () => {
    expect(resolvePm(['install', '--pm=pnpm'], {})).toEqual({
      pm: 'npm',
      argv: ['install', '--pm=pnpm'],
    })
  })
})

describe('commandLine', () => {
  test('prefixes with the given manager and single-quotes args with spaces', () => {
    expect(commandLine(['deprecate', '@s/a', 'use b'], 'pnpm')).toBe("pnpm deprecate @s/a 'use b'")
  })
  test('leaves nothing for a shell to expand: $, backticks, and quotes are inert', () => {
    expect(commandLine(['exec', 'echo', '$HOME', '`id`'], 'npm')).toBe(
      "npm exec echo '$HOME' '`id`'",
    )
    expect(commandLine(['run', "it's"], 'npm')).toBe(`npm run 'it'\\''s'`)
  })
})

describe('managerFor', () => {
  test('npm sessions run everything through npm', () => {
    expect(managerFor('owner-add', 'npm', true)).toBe('npm')
    expect(managerFor('deprecate', 'npm', false)).toBe('npm')
  })
  test('pnpm sessions run deprecate, dist-tag, unpublish, view through pnpm', () => {
    for (const k of [
      'deprecate',
      'undeprecate',
      'dist-tag-add',
      'dist-tag-rm',
      'unpublish',
      'view',
    ] as const) {
      expect(managerFor(k, 'pnpm', true)).toBe('pnpm')
    }
  })
  test('owner and access prefer npm: pnpm 11.27 and 12.4 fail against registry.npmjs.org for both', () => {
    expect(managerFor('owner-add', 'pnpm', true)).toBe('npm')
    expect(managerFor('owner-rm', 'pnpm', true)).toBe('npm')
    expect(managerFor('access', 'pnpm', true)).toBe('npm')
    expect(managerFor('access', 'pnpm', false)).toBe('pnpm')
  })
})
