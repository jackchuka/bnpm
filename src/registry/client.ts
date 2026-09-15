import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import { binFor, runNpm } from '../npm/exec.ts'
import { currentPm } from '../pm.ts'
import type { Packument } from './packument.ts'

const require = createRequire(import.meta.url)

type FlatOptions = Record<string, unknown> & { registry: string }

export type PackageAccess = Record<string, 'read' | 'write'>

export interface Registry {
  flat: FlatOptions
  whoami(): Promise<string>
  userPackages(user: string): Promise<PackageAccess>
  packument(name: string): Promise<Packument>
  visibility(name: string): Promise<'public' | 'private'>
}

function npmPath(): string {
  try {
    return dirname(dirname(realpathSync(binFor('npm'))))
  } catch {
    return process.cwd()
  }
}

export async function loadFlatOptions(): Promise<FlatOptions> {
  const Config = require('@npmcli/config') as new (o: object) => {
    load(): Promise<void>
    flat: FlatOptions
  }
  const { shorthands, definitions, flatten } = require('@npmcli/config/lib/definitions') as {
    shorthands: object
    definitions: object
    flatten: unknown
  }
  const conf = new Config({
    npmPath: npmPath(),
    definitions,
    shorthands,
    flatten,
    argv: [process.execPath, 'npm'],
    env: process.env,
    execPath: process.execPath,
    platform: process.platform,
    cwd: process.cwd(),
  })
  process.on('log', () => {})
  await conf.load()
  return conf.flat
}

export function isNpmjs(registry: string): boolean {
  try {
    return new URL(registry).hostname === 'registry.npmjs.org'
  } catch {
    return false
  }
}

type PnpmConfig = Record<string, unknown>

const isRegistryKey = (k: string) => k === 'registry' || /^@[^/]+:registry$/.test(k)
const isAuthKey = (k: string) => /^\/\/.+:_auth(Token)?$/.test(k)

/**
 * pnpm keeps registry settings in pnpm-workspace.yaml and its own global config, which npm's loader
 * never sees, so under pnpm its resolved config wins. `pnpm config list` masks tokens as
 * "(protected)"; those are fetched one by one, but only where npm's config had nothing.
 */
export async function applyPnpmConfig(
  flat: FlatOptions,
  list: PnpmConfig,
  get: (key: string) => Promise<string>,
): Promise<FlatOptions> {
  const out: FlatOptions = { ...flat }
  for (const [k, v] of Object.entries(list)) {
    if (typeof v !== 'string') continue
    if (isRegistryKey(k)) out[k] = v
    else if (isAuthKey(k) && !(k in flat)) out[k] = v === '(protected)' ? await get(k) : v
  }
  return out
}

async function pnpmFlatOptions(flat: FlatOptions): Promise<FlatOptions> {
  const list = runNpm(['config', 'list', '--json'])
  if (list.status !== 0 || !list.stdout.trim()) return flat
  return applyPnpmConfig(flat, JSON.parse(list.stdout) as PnpmConfig, async (key) => {
    const r = runNpm(['config', 'get', key])
    return r.status === 0 ? r.stdout.trim() : ''
  })
}

export async function createRegistry(): Promise<Registry> {
  const fetch = require('npm-registry-fetch') as {
    json(url: string, opts?: object): Promise<unknown>
  }
  const npmFlat = await loadFlatOptions()
  const flat = currentPm() === 'pnpm' ? await pnpmFlatOptions(npmFlat) : npmFlat
  const json = <T>(url: string, extra: object = {}) =>
    fetch.json(url, { ...flat, ...extra }) as Promise<T>
  return {
    flat,
    async whoami() {
      return (await json<{ username: string }>('/-/whoami')).username
    },
    userPackages(user) {
      return json(`/-/user/${encodeURIComponent(user)}/package`)
    },
    // `spec` lets npm-registry-fetch honour `@scope:registry` for scoped names.
    packument(name) {
      return json(`/${name.replace('/', '%2f')}`, { fullMetadata: true, spec: name })
    },
    // Same endpoint `npm access get status` uses.
    async visibility(name) {
      const v = await json<{ public: boolean }>(
        `/-/package/${name.replace('/', '%2f')}/visibility`,
        {
          spec: name,
        },
      )
      return v.public ? 'public' : 'private'
    },
  }
}
