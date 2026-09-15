import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, test } from 'vitest'
import { readPackageJson, scripts, dependencies } from '../src/pkgjson.ts'

const proj = join(import.meta.dirname, 'fixtures', 'proj')

describe('pkgjson', () => {
  test('reads scripts in declaration order', () => {
    const pkg = readPackageJson(proj)!
    expect(scripts(pkg)).toEqual([
      { name: 'dev', command: 'vite' },
      { name: 'build', command: 'tsc -b && vite build' },
      { name: 'test', command: 'vitest run' },
    ])
  })

  test('lists dependencies with their type, prod first', () => {
    const pkg = readPackageJson(proj)!
    expect(dependencies(pkg)).toEqual([
      { name: 'react', range: '^19.0.0', type: 'prod' },
      { name: 'zod', range: '^3.23.0', type: 'prod' },
      { name: 'vitest', range: '^5.0.0', type: 'dev' },
      { name: 'fsevents', range: '^2.3.0', type: 'optional' },
      { name: 'typescript', range: '>=5', type: 'peer' },
    ])
  })

  test('returns undefined when no package.json exists', () => {
    expect(readPackageJson(mkdtempSync(join(tmpdir(), 'bnpm-')))).toBeUndefined()
  })

  test('walks up to the nearest package.json', () => {
    const nested = join(proj, 'src', 'deep')
    expect(readPackageJson(nested)?.name).toBe('proj')
  })
})
