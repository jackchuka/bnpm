import type { PackageManager } from './pm.ts'

export type Shim =
  | 'run'
  | 'uninstall'
  | 'update'
  | 'deprecate'
  | 'dist-tag'
  | 'view'
  | 'exec'
  | 'link'
  | 'unlink'
  | 'open'
  | 'owner'
  | 'access'
export type OwnCommand = 'mine' | 'alias' | 'menu'

export type Route =
  | { kind: 'passthrough'; argv: string[] }
  | { kind: 'shim'; shim: Shim; argv: string[] }
  | { kind: 'own'; command: OwnCommand; argv: string[] }

export interface RouteContext {
  interactive: boolean
  pm: PackageManager
}

// pnpm ships `update -i`, so that one is left to pnpm. Everything else either errors on bare use,
// only lists, or (unlink) acts on everything at once, so a picker still helps.
const PNPM_SHIMS = new Set<Shim>([
  'run',
  'uninstall',
  'exec',
  'link',
  'unlink',
  'deprecate',
  'dist-tag',
  'view',
  'open',
  'owner',
  'access',
])

const ALIASES: Record<string, Shim> = {
  run: 'run',
  'run-script': 'run',
  uninstall: 'uninstall',
  rm: 'uninstall',
  remove: 'uninstall',
  un: 'uninstall',
  unlink: 'uninstall',
  update: 'update',
  up: 'update',
  upgrade: 'update',
  udpate: 'update',
  outdated: 'update',
  deprecate: 'deprecate',
  'dist-tag': 'dist-tag',
  dist_tag: 'dist-tag',
  view: 'view',
  info: 'view',
  show: 'view',
  v: 'view',
  exec: 'exec',
  x: 'exec',
  link: 'link',
  ln: 'link',
  docs: 'open',
  home: 'open',
  repo: 'open',
  bugs: 'open',
  issues: 'open',
  owner: 'owner',
  author: 'owner',
  access: 'access',
}

// Where pnpm gives a spelling a different meaning. `npm unlink` is an uninstall alias; `pnpm unlink`
// drops linked dependencies.
const PNPM_ALIASES: Record<string, Shim> = {
  unlink: 'unlink',
}

const OWN = new Set<OwnCommand>(['mine', 'alias'])

/**
 * Bare `-i` opens bnpm's command menu. Neither manager claims it at the top level - npm has no
 * `-i` shorthand and pnpm rejects it outright - so nothing is taken away by answering it.
 */
const MENU_FLAGS = new Set(['-i', '--interactive'])

/** Whether bnpm improves this command for this manager at all. */
export const shimApplies = (shim: Shim, pm: PackageManager): boolean =>
  pm === 'npm' || PNPM_SHIMS.has(shim)

const isFlag = (a: string) => a.startsWith('-')
const HELP_FLAGS = new Set(['-h', '--help', '-?'])
const wantsHelp = (argv: string[]) => argv.some((a) => HELP_FLAGS.has(a))

function wantsPrompt(shim: Shim, rest: string[]): boolean {
  const positional = rest.filter((a) => !isFlag(a))
  switch (shim) {
    case 'dist-tag':
      return (
        positional.length === 0 ||
        (positional.length === 1 && ['add', 'rm'].includes(positional[0]!))
      )
    // `owner add <user> <pkg>` / `owner rm <user> <pkg>`: prompt until both are present. `ls` is npm's own.
    case 'owner':
      return (
        positional.length === 0 || (['add', 'rm'].includes(positional[0]!) && positional.length < 3)
      )
    // `access set status=<x> <pkg>`: prompt until the package is present. get/list/grant/revoke pass.
    case 'access':
      return positional.length === 0 || (positional[0] === 'set' && positional.length < 3)
    default:
      return positional.length === 0 && rest.length === 0
  }
}

/** The arguments bnpm itself interprets: everything before `--` belongs to the manager or a script. */
export function bnpmArgs(argv: string[]): string[] {
  const separator = argv.indexOf('--')
  return separator === -1 ? argv : argv.slice(0, separator)
}

export function route(rawArgv: string[], ctx: RouteContext): Route {
  const before = bnpmArgs(rawArgv)
  const after = rawArgv.slice(before.length)
  const plain = before.includes('--plain')
  const argv = [...before.filter((a) => a !== '--plain'), ...after]
  const [cmd, ...rest] = argv
  if (cmd === undefined) return { kind: 'passthrough', argv }

  // Only on its own: `-i` anywhere else is an argument to a real command.
  if (MENU_FLAGS.has(cmd) && rest.length === 0 && !plain) {
    return ctx.interactive
      ? { kind: 'own', command: 'menu', argv: [] }
      : { kind: 'passthrough', argv }
  }

  if (OWN.has(cmd as OwnCommand))
    return { kind: 'own', command: cmd as OwnCommand, argv: plain ? ['--plain', ...rest] : rest }
  // Asking for help is never a reason to prompt; the manager's own help text is the right answer.
  if (wantsHelp(argv)) return { kind: 'passthrough', argv }

  const shim = (ctx.pm === 'pnpm' ? PNPM_ALIASES[cmd] : undefined) ?? ALIASES[cmd]
  if (shim === undefined) return { kind: 'passthrough', argv }

  if (shimApplies(shim, ctx.pm) && ctx.interactive && !plain && wantsPrompt(shim, rest)) {
    return { kind: 'shim', shim, argv }
  }
  return { kind: 'passthrough', argv }
}
