import { execWith, isAvailable } from '../npm/exec.ts'
import { commandLine, currentPm } from '../pm.ts'
import { buildArgv, managerFor, supportsDryRun, type ActionKind } from '../mine/actions.ts'
import { flow } from '../mine/flows.ts'
import { summarize } from '../registry/packument.ts'
import { errorMessage } from '../errors.ts'
import { createRegistry, isNpmjs, type PackageAccess } from '../registry/client.ts'
import type { MineRow } from '../mine/rows.ts'
import { ask, cancelled, guard, p, pick, pickOrType } from '../ui/prompts.ts'
import pc from '../ui/colors.ts'
import { readPackageJson } from '../pkgjson.ts'
import { driveFlow, type FlowPrompts } from './flow-adapter.ts'
import { packageChoices } from './package-picker.ts'

const clackPrompts: FlowPrompts = {
  pick: (title, choices, allowCustom) => {
    const options = choices.map((c) => ({
      value: c.value,
      label: c.danger ? pc.red(c.label) : c.label,
      hint: c.hint,
    }))
    return allowCustom ? pickOrType(title, options, allowCustom) : pick(title, options)
  },
  text: (title, opts) =>
    ask(title, {
      ...(opts.placeholder ? { placeholder: opts.placeholder } : {}),
      required: opts.required ?? false,
    }),
  async typed(title, expected) {
    return guard<string>(
      await p.text({
        message: title,
        validate: (v) => (v === expected ? undefined : `type ${expected} exactly`),
      }),
    )
  },
}

async function pickOwnPackage(): Promise<MineRow> {
  const registry = await createRegistry()
  const s = p.spinner()
  s.start('Loading your packages')
  let user: string
  let pkgs: PackageAccess
  try {
    user = await registry.whoami()
    pkgs = await registry.userPackages(user)
  } catch (err) {
    // These flows publish as the account, so unlike `view` there is no local fallback.
    s.stop(pc.red(`account packages unavailable: ${errorMessage(err)}`))
    return cancelled()
  }
  s.stop(`${Object.keys(pkgs).length} packages · ${user}`)
  const current = readPackageJson(process.cwd())?.name
  const name = await pickOrType('Package', packageChoices(pkgs, current), 'package')
  s.start(`Loading ${name}`)
  let summary
  try {
    summary = summarize(await registry.packument(name))
  } catch (err) {
    s.stop(pc.red(`${name}: ${errorMessage(err)}`))
    return cancelled()
  }
  s.stop(`${name}@${summary.latest ?? '?'} · ${summary.versions.length} versions`)
  return {
    name,
    // Packages typed by hand are unknown to the access list; assume write and let npm refuse if not.
    access: pkgs[name] ?? 'write',
    status: 'loaded',
    summary,
    latest: summary.latest,
    deprecatedCount: summary.deprecatedCount,
    latestDeprecated: summary.latestDeprecated,
  }
}

async function runRegistryFlow(kind: ActionKind, argv: string[]): Promise<number> {
  const row = await pickOwnPackage()
  const registry = await createRegistry()
  const user = await registry.whoami()
  if (kind === 'owner') {
    const owners = row.summary?.maintainers ?? []
    p.log.info(
      owners.length ? `${row.name} owners: ${owners.join(', ')}` : `${row.name}: no owners listed`,
    )
  }
  if (kind === 'access') {
    const s = p.spinner()
    s.start('Checking current access')
    row.visibility = await registry.visibility(row.name).catch(() => undefined)
    s.stop(row.visibility ? `${row.name} is ${row.visibility}` : 'current access unknown')
  }
  const result = await driveFlow(flow(kind, row, user), clackPrompts)
  if (!result || result.kind === 'open') return cancelled()
  const plan = buildArgv(result)
  const pm = managerFor(result.kind, currentPm(), isAvailable('npm'))
  const choice = await pick<'run' | 'dry' | 'cancel'>(`$ ${commandLine(plan, pm)}`, [
    { value: 'run', label: 'Run' },
    ...(supportsDryRun(result.kind, pm)
      ? [{ value: 'dry' as const, label: 'Dry run', hint: '--dry-run' }]
      : []),
    { value: 'cancel', label: 'Cancel' },
  ])
  if (choice === 'cancel') return cancelled()
  void argv
  return execWith(pm, buildArgv(result, { dryRun: choice === 'dry', pm }))
}

export const deprecateShim = (argv: string[]) => runRegistryFlow('deprecate', argv)
export const distTagShim = (argv: string[]) => runRegistryFlow('dist-tag', argv)
export const ownerShim = (argv: string[]) => runRegistryFlow('owner', argv)
export const accessShim = (argv: string[]) => runRegistryFlow('access', argv)

export async function viewShim(argv: string[]): Promise<number> {
  const { pickPackage, viewTargets, planOpen, runPlan } = await import('./web.ts')
  const registry = await createRegistry()
  const name = await pickPackage('View', registry)
  const target = await pick('Open in', viewTargets(isNpmjs(registry.flat.registry)))
  const plan = planOpen(target, name, currentPm())
  // Keep the word the user typed (view, info, show) when it goes back to the manager.
  if ('argv' in plan && target === 'terminal') plan.argv[0] = argv[0] ?? 'view'
  return runPlan(plan)
}
