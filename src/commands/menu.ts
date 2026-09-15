import { execNpm } from '../npm/exec.ts'
import { readPackageJson } from '../pkgjson.ts'
import { currentPm, type PackageManager } from '../pm.ts'
import { route } from '../route.ts'
import { pick, type Choice } from '../ui/prompts.ts'

export interface MenuEntry {
  /** The command word, routed exactly as if it had been typed. */
  word: string
  label: string
  hint: string
  /** Reads `package.json`, so it is pointless outside a project. */
  project?: boolean
}

const ENTRIES: MenuEntry[] = [
  { word: 'run', label: 'run', hint: 'pick a package.json script', project: true },
  { word: 'uninstall', label: 'uninstall', hint: 'remove dependencies', project: true },
  { word: 'update', label: 'update', hint: 'update outdated packages', project: true },
  { word: 'exec', label: 'exec', hint: 'run a bin from node_modules/.bin', project: true },
  { word: 'link', label: 'link', hint: 'link a package into this project', project: true },
  { word: 'view', label: 'view', hint: 'inspect a package' },
  { word: 'docs', label: 'docs', hint: 'open homepage, repo or issues' },
  { word: 'deprecate', label: 'deprecate', hint: 'deprecate a version or range' },
  { word: 'dist-tag', label: 'dist-tag', hint: 'add, remove or list tags' },
  { word: 'owner', label: 'owner', hint: 'manage maintainers' },
  { word: 'access', label: 'access', hint: 'public or private' },
  { word: 'mine', label: 'mine', hint: 'the packages you publish' },
]

/**
 * What is worth offering here. A command bnpm does not improve for this manager would just be
 * handed straight back to it, so listing it would promise something the menu does not deliver -
 * `update` under pnpm, for instance, which ships its own `update -i`.
 */
export function menuEntries(pm: PackageManager, hasProject: boolean): MenuEntry[] {
  return ENTRIES.filter((e) => {
    if (e.project && !hasProject) return false
    return route([e.word], { interactive: true, pm }).kind !== 'passthrough'
  })
}

export async function menuCommand(): Promise<number> {
  const pm = currentPm()
  const pkg = readPackageJson(process.cwd())
  const entries = menuEntries(pm, pkg !== undefined)
  if (entries.length === 0) return execNpm([])

  const choices: Choice<string>[] = entries.map((e) => ({
    value: e.word,
    label: e.label,
    hint: e.hint,
  }))
  const word = await pick('bnpm', choices, pkg?.name ? `${pkg.name} · ${pm}` : pm)

  // Routed rather than dispatched directly, so picking a command behaves exactly like typing it.
  const r = route([word], { interactive: true, pm })
  switch (r.kind) {
    case 'own':
      return (await import('../mine/index.ts')).mineCommand(r.argv)
    case 'shim':
      return (await import('../shims/index.ts')).runShim(r.shim, r.argv)
    case 'passthrough':
      return execNpm(r.argv)
  }
}
