import { PACKAGE_MANAGERS, type PackageManager } from '../pm.ts'

type Shell = 'zsh' | 'bash' | 'sh' | 'fish' | 'nu' | 'powershell' | 'pwsh'
const SHELLS: Shell[] = ['zsh', 'bash', 'sh', 'fish', 'nu', 'powershell', 'pwsh']

const isShell = (s: string): s is Shell => (SHELLS as string[]).includes(s)
const isPm = (s: string): s is PackageManager => (PACKAGE_MANAGERS as string[]).includes(s)

export function detectShell(env: NodeJS.ProcessEnv = process.env): Shell {
  const base = (env.SHELL ?? '').split('/').pop() ?? ''
  return isShell(base) ? base : 'zsh'
}

export function aliasLine(shell: string, pm: PackageManager = 'npm'): string {
  if (!isShell(shell)) throw new Error(`unknown shell "${shell}" (known: ${SHELLS.join(', ')})`)
  // npm needs no flag; every other manager is carried as a leading --pm so bnpm knows whom to stand in for.
  const target = pm === 'npm' ? 'bnpm' : `bnpm --pm=${pm}`
  const quoted = pm === 'npm' ? target : `'${target}'`
  switch (shell) {
    case 'zsh':
      // zsh substitutes an alias before it looks for a completion, so `alias npm=bnpm` sends the
      // lookup to bnpm and npm's own completion never fires. A function leaves the command word
      // alone, and _bnpm hands `bnpm <TAB>` to whichever completion the manager has registered,
      // resolved at completion time so the order of the lines in ~/.zshrc does not matter.
      return [
        `${pm}() { ${target} "$@" }`,
        `_bnpm() { words[1]=${pm}; _normal }`,
        `(( $+functions[compdef] )) && compdef _bnpm bnpm`,
      ].join('\n')
    case 'fish':
      return `alias ${pm} ${quoted}`
    case 'nu':
      return `alias ${pm} = ${target}`
    case 'powershell':
    case 'pwsh':
      return pm === 'npm'
        ? `Set-Alias -Name npm -Value bnpm`
        : `function ${pm} { bnpm --pm=${pm} @args }`
    default:
      return `alias ${pm}=${quoted}`
  }
}

export function aliasCommand(argv: string[]): number {
  const words = argv.filter((a) => !a.startsWith('-'))
  const pm = words.find(isPm) ?? 'npm'
  const shell = words.find(isShell) ?? detectShell()
  const unknown = words.find((w) => !isPm(w) && !isShell(w))
  if (unknown) throw new Error(`unknown shell or package manager "${unknown}"`)
  process.stdout.write(aliasLine(shell, pm) + '\n')
  return 0
}
