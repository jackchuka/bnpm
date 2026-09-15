import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type DepType = 'prod' | 'dev' | 'optional' | 'peer'

export interface PackageJson {
  name?: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export interface Script {
  name: string
  command: string
}

export interface Dependency {
  name: string
  range: string
  type: DepType
}

export function findPackageJson(from: string): string | undefined {
  let dir = from
  for (;;) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export function readPackageJson(from: string): PackageJson | undefined {
  const file = findPackageJson(from)
  if (!file) return undefined
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson
}

export function scripts(pkg: PackageJson): Script[] {
  return Object.entries(pkg.scripts ?? {}).map(([name, command]) => ({ name, command }))
}

const DEP_FIELDS: [keyof PackageJson, DepType][] = [
  ['dependencies', 'prod'],
  ['devDependencies', 'dev'],
  ['optionalDependencies', 'optional'],
  ['peerDependencies', 'peer'],
]

export function dependencies(pkg: PackageJson): Dependency[] {
  return DEP_FIELDS.flatMap(([field, type]) =>
    Object.entries((pkg[field] as Record<string, string> | undefined) ?? {}).map(
      ([name, range]) => ({
        name,
        range,
        type,
      }),
    ),
  )
}
