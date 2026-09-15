import { chmodSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { locateNpm } from '../../src/npm/locate.ts'

function fakeBin(dir: string, name: string): string {
  mkdirSync(dir, { recursive: true })
  const p = join(dir, name)
  writeFileSync(p, '#!/bin/sh\n')
  chmodSync(p, 0o755)
  return p
}

describe('locateNpm', () => {
  test('returns the first executable named npm on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'bnpm-'))
    const a = join(root, 'a')
    const b = join(root, 'b')
    const npmB = fakeBin(b, 'npm')
    mkdirSync(a)
    expect(locateNpm({ path: [a, b].join(':'), self: '/nowhere/bnpm' })).toBe(npmB)
  })

  test('skips an npm entry that is really bnpm (symlink shim install)', () => {
    const root = mkdtempSync(join(tmpdir(), 'bnpm-'))
    const shimDir = join(root, 'shim')
    const realDir = join(root, 'real')
    const self = fakeBin(root, 'bnpm')
    mkdirSync(shimDir)
    symlinkSync(self, join(shimDir, 'npm'))
    const real = fakeBin(realDir, 'npm')
    expect(locateNpm({ path: [shimDir, realDir].join(':'), self })).toBe(real)
  })

  test('falls back to npm_execpath when nothing on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'bnpm-'))
    const cli = fakeBin(root, 'npm-cli.js')
    expect(locateNpm({ path: '', self: '/x/bnpm', npmExecPath: cli })).toBe(cli)
  })

  test('throws a clear error when npm cannot be found', () => {
    expect(() => locateNpm({ path: '', self: '/x/bnpm' })).toThrow(/npm not found/)
  })
})
