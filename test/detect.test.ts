import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { detectPm } from '../src/pm.ts'

const proj = (files: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), 'bnpm-detect-'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(root, name), content)
  return root
}

describe('detectPm', () => {
  test('pnpm-lock.yaml means pnpm', () => {
    expect(detectPm(proj({ 'pnpm-lock.yaml': '' }))).toBe('pnpm')
  })
  test('package-lock.json or npm-shrinkwrap.json means npm', () => {
    expect(detectPm(proj({ 'package-lock.json': '{}' }))).toBe('npm')
    expect(detectPm(proj({ 'npm-shrinkwrap.json': '{}' }))).toBe('npm')
  })
  test('the packageManager field wins over a stale lockfile', () => {
    const root = proj({
      'package.json': JSON.stringify({ packageManager: 'pnpm@10.4.0+sha512.abc' }),
      'package-lock.json': '{}',
    })
    expect(detectPm(root)).toBe('pnpm')
  })
  test('walks up to the nearest marker', () => {
    const root = proj({ 'pnpm-lock.yaml': '' })
    const nested = join(root, 'packages', 'a', 'src')
    mkdirSync(nested, { recursive: true })
    expect(detectPm(nested)).toBe('pnpm')
  })
  test('unsupported managers and no project both yield undefined', () => {
    expect(detectPm(proj({ 'yarn.lock': '' }))).toBeUndefined()
    expect(
      detectPm(proj({ 'package.json': JSON.stringify({ packageManager: 'bun@1.2.0' }) })),
    ).toBeUndefined()
    expect(detectPm(proj({}))).toBeUndefined()
  })
  test('a package.json without markers keeps walking up', () => {
    const root = proj({ 'pnpm-lock.yaml': '' })
    const sub = join(root, 'packages', 'a')
    mkdirSync(sub, { recursive: true })
    writeFileSync(join(sub, 'package.json'), '{"name":"a"}')
    expect(detectPm(sub)).toBe('pnpm')
  })
})
