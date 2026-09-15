import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { execNpm, npmJson } from '../npm/exec.ts'
import { findPackageJson, readPackageJson, type PackageJson } from '../pkgjson.ts'
import { currentPm } from '../pm.ts'
import { ask, p, pick, showCommand } from '../ui/prompts.ts'
import { NPM_DEFAULT } from './exec.ts'

export interface GlobalLink {
  name: string
  path: string
}

interface LsTree {
  dependencies?: Record<string, { resolved?: string }>
}

export function parseGlobalLinks(json: LsTree): GlobalLink[] {
  return Object.entries(json.dependencies ?? {})
    .filter(([, d]) => d.resolved?.startsWith('file:'))
    .map(([name, d]) => ({ name, path: (d.resolved ?? '').slice('file:'.length) }))
}

export function planLink(target: string): string[] {
  return ['link', target]
}

export function planUnlink(name: string): string[] {
  return ['unlink', name]
}

export interface LinkCandidate {
  name: string
  version: string | undefined
  path: string
}

/** Sibling directories of the project that hold a package.json: the usual `pnpm link ../x` targets. */
export function linkCandidates(cwd: string): LinkCandidate[] {
  const own = findPackageJson(cwd)
  const projectDir = own ? dirname(own) : cwd
  const parent = dirname(projectDir)
  if (parent === projectDir) return []
  const out: LinkCandidate[] = []
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === basename(projectDir)) continue
    const file = join(parent, entry.name, 'package.json')
    if (!existsSync(file)) continue
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as PackageJson
      out.push({ name: pkg.name ?? entry.name, version: pkg.version, path: `../${entry.name}` })
    } catch {
      // Unreadable package.json: not a linkable package.
    }
  }
  return out.toSorted((a, b) => a.name.localeCompare(b.name))
}

type PnpmDep = { version?: string }
interface PnpmLsProject {
  dependencies?: Record<string, PnpmDep>
  devDependencies?: Record<string, PnpmDep>
  optionalDependencies?: Record<string, PnpmDep>
}

/** Linked dependencies from `pnpm ls --json --depth=0`, which reports them as `link:<path>`. */
export function parsePnpmLinks(json: PnpmLsProject[]): GlobalLink[] {
  const project = json[0] ?? {}
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies'] as const
  return fields.flatMap((f) =>
    Object.entries(project[f] ?? {})
      .filter(([, d]) => d.version?.startsWith('link:'))
      .map(([name, d]) => ({ name, path: (d.version ?? '').slice('link:'.length) })),
  )
}

const OTHER = '__other_path__'

async function pnpmLinkShim(): Promise<number> {
  const candidates = linkCandidates(process.cwd())
  const choice = await pick(
    'Link',
    [
      ...candidates.map((c) => ({
        value: c.path,
        label: c.path,
        hint: c.version ? `${c.name}@${c.version}` : c.name,
      })),
      { value: OTHER, label: 'another path', hint: 'type it' },
    ],
    candidates.length ? `${candidates.length} sibling packages` : undefined,
  )
  const target = choice === OTHER ? await ask('Path to link', { required: true }) : choice
  const plan = planLink(target.trim())
  showCommand(plan)
  return execNpm(plan)
}

async function npmLinkShim(argv: string[]): Promise<number> {
  const s = p.spinner()
  s.start('Looking up globally linked packages')
  const links = parseGlobalLinks(npmJson<LsTree>(['ls', '-g', '--link', '--depth=0']))
  s.stop(links.length ? `${links.length} linked globally` : 'nothing linked globally yet')

  const self = readPackageJson(process.cwd())?.name
  const choice = await pick('Link', [
    {
      value: NPM_DEFAULT,
      label: self ? `link ${self} globally` : 'link this package globally',
      hint: "npm's default",
    },
    ...links
      .filter((l) => l.name !== self)
      .map((l) => ({ value: l.name, label: l.name, hint: l.path })),
  ])
  if (choice === NPM_DEFAULT) return execNpm(argv)
  const plan = planLink(choice)
  showCommand(plan)
  return execNpm(plan)
}

export function linkShim(argv: string[]): Promise<number> {
  return currentPm() === 'pnpm' ? pnpmLinkShim() : npmLinkShim(argv)
}

/** pnpm only: bare `pnpm unlink` drops every link, so that stays first and single links follow. */
export async function unlinkShim(argv: string[]): Promise<number> {
  const s = p.spinner()
  s.start('Looking up linked dependencies')
  const links = parsePnpmLinks(npmJson<PnpmLsProject[]>(['ls', '--depth=0']))
  s.stop(links.length ? `${links.length} linked` : 'nothing linked')
  if (links.length === 0) return execNpm(argv)

  const choice = await pick('Unlink', [
    { value: NPM_DEFAULT, label: 'unlink everything', hint: "pnpm's default" },
    ...links.map((l) => ({ value: l.name, label: l.name, hint: l.path })),
  ])
  if (choice === NPM_DEFAULT) return execNpm(argv)
  const plan = planUnlink(choice)
  showCommand(plan)
  return execNpm(plan)
}
