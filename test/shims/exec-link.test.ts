import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { execChoices, listBins, planExec, splitArgs, NPM_DEFAULT } from '../../src/shims/exec.ts'
import {
  linkCandidates,
  parseGlobalLinks,
  parsePnpmLinks,
  planLink,
  planUnlink,
} from '../../src/shims/link.ts'

describe('exec shim', () => {
  test('listBins returns executables in the nearest node_modules/.bin, sorted', () => {
    const root = mkdtempSync(join(tmpdir(), 'bnpm-'))
    const bin = join(root, 'node_modules', '.bin')
    mkdirSync(bin, { recursive: true })
    for (const n of ['vitest', 'tsc', 'eslint']) {
      writeFileSync(join(bin, n), '#!/bin/sh\n')
      chmodSync(join(bin, n), 0o755)
    }
    writeFileSync(join(bin, 'notes.txt'), 'x')
    const nested = join(root, 'src', 'deep')
    mkdirSync(nested, { recursive: true })
    expect(listBins(nested)).toEqual(['eslint', 'tsc', 'vitest'])
  })

  test('listBins is empty when there is no node_modules', () => {
    expect(listBins(mkdtempSync(join(tmpdir(), 'bnpm-')))).toEqual([])
  })

  test('splitArgs splits on whitespace and honours quotes and backslashes', () => {
    expect(splitArgs('')).toEqual([])
    expect(splitArgs('  run   --coverage ')).toEqual(['run', '--coverage'])
    expect(splitArgs('--write "src/my file.ts"')).toEqual(['--write', 'src/my file.ts'])
    expect(splitArgs('-m \'it works\' --name="a b"')).toEqual(['-m', 'it works', '--name=a b'])
    expect(splitArgs('a\\ b "c\\"d"')).toEqual(['a b', 'c"d'])
    expect(splitArgs('"unterminated')).toEqual(['unterminated'])
  })

  test('planExec builds npm exec -- <bin> [args]', () => {
    expect(planExec('vitest', '', 'npm')).toEqual(['exec', '--', 'vitest'])
    expect(planExec('vitest', 'run --coverage', 'npm')).toEqual([
      'exec',
      '--',
      'vitest',
      'run',
      '--coverage',
    ])
  })

  test('planExec for pnpm omits the -- separator', () => {
    expect(planExec('vitest', 'run', 'pnpm')).toEqual(['exec', 'vitest', 'run'])
  })

  test('execChoices offers the shell default only under npm', () => {
    expect(execChoices(['a', 'b'], 'npm').map((c) => c.value)).toEqual([NPM_DEFAULT, 'a', 'b'])
    expect(execChoices(['a', 'b'], 'pnpm').map((c) => c.value)).toEqual(['a', 'b'])
  })
})

describe('link shim', () => {
  test('parseGlobalLinks extracts linked package names and their paths', () => {
    const json = {
      name: 'lib',
      dependencies: {
        '@me/tool': { version: '1.0.0', resolved: 'file:../../../home/me/tool' },
        left: { version: '0.1.0', resolved: 'file:../../../home/me/left' },
      },
    }
    expect(parseGlobalLinks(json)).toEqual([
      { name: '@me/tool', path: '../../../home/me/tool' },
      { name: 'left', path: '../../../home/me/left' },
    ])
  })

  test('parseGlobalLinks tolerates an empty tree', () => {
    expect(parseGlobalLinks({})).toEqual([])
  })

  test('planLink builds npm link <name>', () => {
    expect(planLink('@me/tool')).toEqual(['link', '@me/tool'])
  })
})

describe('pnpm link shim', () => {
  test('linkCandidates lists sibling directories with a package.json, excluding the project', () => {
    const root = mkdtempSync(join(tmpdir(), 'bnpm-'))
    const write = (dir: string, json: object) => {
      mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(join(root, dir, 'package.json'), JSON.stringify(json))
    }
    write('app', { name: 'app', version: '1.0.0' })
    write('lib', { name: '@me/lib', version: '2.3.4' })
    write('tool', { name: 'tool' })
    mkdirSync(join(root, 'notes'))
    writeFileSync(join(root, 'README.md'), '')
    expect(linkCandidates(join(root, 'app'))).toEqual([
      { name: '@me/lib', version: '2.3.4', path: '../lib' },
      { name: 'tool', version: undefined, path: '../tool' },
    ])
  })

  test('linkCandidates is empty at the filesystem root', () => {
    expect(linkCandidates('/')).toEqual([])
  })

  test('parsePnpmLinks picks link: deps of every type from pnpm ls --json', () => {
    const json = [
      {
        name: 'app',
        dependencies: {
          lib: { from: 'lib', version: 'link:../lib', path: '/w/lib' },
          zod: { from: 'zod', version: '4.0.0', path: '/w/app/node_modules/zod' },
        },
        devDependencies: { tool: { from: 'tool', version: 'link:../../tool', path: '/w/tool' } },
      },
    ]
    expect(parsePnpmLinks(json)).toEqual([
      { name: 'lib', path: '../lib' },
      { name: 'tool', path: '../../tool' },
    ])
  })

  test('parsePnpmLinks tolerates an empty listing', () => {
    expect(parsePnpmLinks([])).toEqual([])
    expect(parsePnpmLinks([{}])).toEqual([])
  })

  test('planUnlink builds pnpm unlink <name>', () => {
    expect(planUnlink('lib')).toEqual(['unlink', 'lib'])
  })
})
