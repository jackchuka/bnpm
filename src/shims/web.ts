import { errorMessage } from '../errors.ts'
import { execWith } from '../npm/exec.ts'
import { npmjsUrl, openUrl } from '../open.ts'
import { dependencies, readPackageJson } from '../pkgjson.ts'
import { currentPm, type PackageManager } from '../pm.ts'
import { createRegistry, type PackageAccess, type Registry } from '../registry/client.ts'
import pc from '../ui/colors.ts'
import { p, pickOrType, showCommand, type Choice } from '../ui/prompts.ts'
import { packageChoices } from './package-picker.ts'

export type OpenTarget = 'terminal' | 'npmjs' | 'repo' | 'docs' | 'bugs'

/** Bare npm commands that open a browser and default to the current package. */
export const OPEN_SHIMS: Record<string, Exclude<OpenTarget, 'terminal' | 'npmjs'>> = {
  docs: 'docs',
  home: 'docs',
  repo: 'repo',
  bugs: 'bugs',
  issues: 'bugs',
}

export function viewTargets(npmjs: boolean): Choice<OpenTarget>[] {
  return [
    { value: 'terminal', label: 'terminal', hint: 'print the registry record' },
    ...(npmjs
      ? [{ value: 'npmjs' as const, label: 'npmjs.com', hint: 'open the package page' }]
      : []),
    { value: 'repo', label: 'repository', hint: 'open the repository URL' },
    { value: 'docs', label: 'homepage', hint: 'open the homepage URL' },
  ]
}

export type OpenPlan = { pm: PackageManager; argv: string[] } | { url: string }

export function planOpen(target: OpenTarget, pkg: string, pm: PackageManager): OpenPlan {
  if (target === 'npmjs') return { url: npmjsUrl(pkg) }
  return { pm, argv: [target === 'terminal' ? 'view' : target, pkg] }
}

export async function runPlan(plan: OpenPlan): Promise<number> {
  if ('url' in plan) {
    p.log.step(`opening ${plan.url}`)
    openUrl(plan.url)
    return 0
  }
  showCommand(plan.argv)
  return execWith(plan.pm, plan.argv)
}

export async function pickPackage(title: string, registry?: Registry): Promise<string> {
  registry ??= await createRegistry()
  const s = p.spinner()
  s.start('Loading your packages')
  let pkgs: PackageAccess = {}
  try {
    pkgs = await registry.userPackages(await registry.whoami())
    s.stop(`${Object.keys(pkgs).length} packages`)
  } catch (err) {
    s.stop(pc.red(`account packages unavailable: ${errorMessage(err)}`))
    p.log.info('choose a local package or type a name')
  }
  const pkg = readPackageJson(process.cwd())
  return pickOrType(title, packageChoices(pkgs, pkg?.name, pkg ? dependencies(pkg) : []), 'package')
}

/** `npm docs` / `repo` / `bugs` with no package: pick one, then let the manager open it. */
export async function openShim(argv: string[]): Promise<number> {
  const word = argv[0] ?? 'docs'
  const target = OPEN_SHIMS[word] ?? 'docs'
  const name = await pickPackage(word)
  const plan = planOpen(target, name, currentPm())
  if ('argv' in plan) plan.argv[0] = word
  return runPlan(plan)
}
