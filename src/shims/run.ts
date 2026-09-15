import { readPackageJson, scripts } from '../pkgjson.ts'
import { execNpm } from '../npm/exec.ts'
import { pick, showCommand } from '../ui/prompts.ts'

export function planRun(script: string): string[] {
  return ['run', script]
}

export async function runShim(_argv: string[]): Promise<number> {
  const pkg = readPackageJson(process.cwd())
  const list = pkg ? scripts(pkg) : []
  if (list.length === 0) return execNpm(['run'])

  const name = await pick(
    'Run script',
    list.map((s) => ({ value: s.name, label: s.name, hint: s.command })),
    `${pkg?.name ?? 'package.json'} · ${list.length} scripts`,
  )
  const argv = planRun(name)
  showCommand(argv)
  return execNpm(argv)
}
