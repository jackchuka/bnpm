import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type PackageManager = 'npm' | 'pnpm'

export const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm']

const isPm = (s: string): s is PackageManager => (PACKAGE_MANAGERS as string[]).includes(s)

function parse(value: string): PackageManager {
  if (isPm(value)) return value
  throw new Error(`unknown package manager "${value}" (known: ${PACKAGE_MANAGERS.join(', ')})`)
}

const LOCKFILES: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]

/** Walk up from `cwd` to the nearest project marker: packageManager field first, then lockfiles. */
export function detectPm(cwd: string): PackageManager | undefined {
  let dir = cwd
  for (;;) {
    const pkg = join(dir, 'package.json')
    if (existsSync(pkg)) {
      try {
        const field = (JSON.parse(readFileSync(pkg, 'utf8')) as { packageManager?: string })
          .packageManager
        const name = field?.split('@')[0]
        if (name) return isPm(name) ? name : undefined
      } catch {
        // Unreadable package.json: fall through to lockfiles.
      }
    }
    for (const [file, pm] of LOCKFILES) if (existsSync(join(dir, file))) return pm
    if (
      existsSync(join(dir, 'yarn.lock')) ||
      existsSync(join(dir, 'bun.lock')) ||
      existsSync(join(dir, 'bun.lockb'))
    )
      return undefined
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Precedence: a leading --pm flag (how `alias pnpm='bnpm --pm=pnpm'` passes it, since an alias
 * cannot change argv[0]), then BNPM_PM, then the project's own manager, then npm.
 * Only a leading flag is ours; anything later belongs to the manager.
 */
export function resolvePm(
  argv: string[],
  env: NodeJS.ProcessEnv,
  detect: () => PackageManager | undefined = () => detectPm(process.cwd()),
): { pm: PackageManager; argv: string[] } {
  const [first, second, ...rest] = argv
  if (first?.startsWith('--pm='))
    return { pm: parse(first.slice('--pm='.length)), argv: argv.slice(1) }
  if (first === '--pm' && second !== undefined) return { pm: parse(second), argv: rest }
  if (env.BNPM_PM) return { pm: parse(env.BNPM_PM), argv }
  return { pm: detect() ?? 'npm', argv }
}

let current: PackageManager = 'npm'

export function setPm(pm: PackageManager): void {
  current = pm
}

export function currentPm(): PackageManager {
  return current
}

// Single quotes leave nothing for a shell to expand, so the echoed line is exactly what ran.
const shellQuote = (s: string) =>
  /^[\w@/.:^~+=-]+$/.test(s) ? s : `'${s.replaceAll("'", "'\\''")}'`

export function commandLine(argv: string[], pm: PackageManager = current): string {
  return `${pm} ${argv.map(shellQuote).join(' ')}`
}
