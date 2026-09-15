import { dependencies, readPackageJson, type Dependency } from '../pkgjson.ts'
import { execNpm } from '../npm/exec.ts'
import { currentPm, type PackageManager } from '../pm.ts'
import { pickMany, showCommand } from '../ui/prompts.ts'

export function planUninstall(names: string[]): string[] {
  return ['uninstall', ...names]
}

// pnpm remove only knows prod/dev/optional; naming a peer fails the whole command.
export function removable(deps: Dependency[], pm: PackageManager): Dependency[] {
  return pm === 'pnpm' ? deps.filter((d) => d.type !== 'peer') : deps
}

export async function uninstallShim(argv: string[]): Promise<number> {
  const pkg = readPackageJson(process.cwd())
  const deps = pkg ? removable(dependencies(pkg), currentPm()) : []
  if (deps.length === 0) return execNpm(argv)

  const chosen = await pickMany(
    'Uninstall',
    deps.map((d) => ({
      value: d.name,
      label: d.name,
      hint: d.type === 'prod' ? d.range : `${d.range} ${d.type}`,
    })),
    `${deps.length} dependencies`,
  )
  const plan = planUninstall(chosen)
  showCommand(plan)
  return execNpm(plan)
}
