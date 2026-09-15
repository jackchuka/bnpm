import { describe, expect, test } from 'vitest'
import { applyPnpmConfig, isNpmjs } from '../../src/registry/client.ts'

describe('isNpmjs', () => {
  test('true only for registry.npmjs.org', () => {
    expect(isNpmjs('https://registry.npmjs.org/')).toBe(true)
    expect(isNpmjs('https://registry.npmjs.org')).toBe(true)
    expect(isNpmjs('https://npm.corp.test/')).toBe(false)
    expect(isNpmjs('https://registry.npmjs.org.evil.test/')).toBe(false)
    expect(isNpmjs('not a url')).toBe(false)
  })
})

describe('applyPnpmConfig', () => {
  const list = {
    registry: 'https://npm.example.test/',
    '@corp:registry': 'https://npm.corp.test/',
    '@jsr:registry': 'https://npm.jsr.io/',
    '//npm.example.test/:_authToken': '(protected)',
    '//npm.corp.test/:_authToken': '(protected)',
    '//registry.npmjs.org/:_authToken': '(protected)',
    userAgent: 'pnpm/12.4.1',
    registries: { 'https://npm.example.test/': { scopes: ['@'] } },
  }

  test('pnpm registry and scoped registries override what npm loaded', async () => {
    const flat = { registry: 'https://registry.npmjs.org/', '@corp:registry': 'https://old.test/' }
    const out = await applyPnpmConfig(flat, list, async () => '')
    expect(out.registry).toBe('https://npm.example.test/')
    expect(out['@corp:registry']).toBe('https://npm.corp.test/')
    expect(out['@jsr:registry']).toBe('https://npm.jsr.io/')
    expect(out).not.toHaveProperty('userAgent')
    expect(out).not.toHaveProperty('registries')
  })

  test('protected tokens are fetched only for hosts npm did not already know', async () => {
    const asked: string[] = []
    const flat = { registry: 'x', '//registry.npmjs.org/:_authToken': 'from-npmrc' }
    const out = await applyPnpmConfig(flat, list, async (key) => {
      asked.push(key)
      return `secret-for-${key}`
    })
    expect(asked.toSorted()).toEqual([
      '//npm.corp.test/:_authToken',
      '//npm.example.test/:_authToken',
    ])
    expect(out['//npm.example.test/:_authToken']).toBe('secret-for-//npm.example.test/:_authToken')
    expect(out['//registry.npmjs.org/:_authToken']).toBe('from-npmrc')
  })

  test('an empty pnpm listing leaves npm config alone', async () => {
    const flat = { registry: 'https://registry.npmjs.org/' }
    expect(await applyPnpmConfig(flat, {}, async () => '')).toEqual(flat)
  })
})
