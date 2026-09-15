import { accessSync, constants, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execNpm } from '../npm/exec.ts'
import { currentPm, type PackageManager } from '../pm.ts'
import { ask, pick, showCommand, type Choice } from '../ui/prompts.ts'

export const NPM_DEFAULT = '__npm_default__'

export function listBins(from: string): string[] {
  let dir = from
  for (;;) {
    const bin = join(dir, 'node_modules', '.bin')
    try {
      if (statSync(bin).isDirectory()) {
        return readdirSync(bin)
          .filter((n) => {
            try {
              accessSync(join(bin, n), constants.X_OK)
              return !n.includes('.')
            } catch {
              return false
            }
          })
          .toSorted()
      }
    } catch {
      // No .bin at this level, keep walking up.
    }
    const parent = dirname(dir)
    if (parent === dir) return []
    dir = parent
  }
}

/** Shell-style word splitting: whitespace separates, quotes group, backslash escapes. */
export function splitArgs(input: string): string[] {
  const out: string[] = []
  let word = ''
  let inWord = false
  let quote: '"' | "'" | undefined
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    if (quote) {
      if (ch === quote) quote = undefined
      else if (ch === '\\' && quote === '"' && i + 1 < input.length) word += input[++i]
      else word += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      inWord = true
    } else if (ch === '\\' && i + 1 < input.length) {
      word += input[++i]
      inWord = true
    } else if (/\s/.test(ch)) {
      if (inWord) out.push(word)
      word = ''
      inWord = false
    } else {
      word += ch
      inWord = true
    }
  }
  if (inWord) out.push(word)
  return out
}

export function planExec(bin: string, args: string, pm: PackageManager): string[] {
  const rest = splitArgs(args)
  // npm needs `--` so its own flag parser stops; pnpm treats everything after the bin as positional.
  return pm === 'npm' ? ['exec', '--', bin, ...rest] : ['exec', bin, ...rest]
}

export function execChoices(bins: string[], pm: PackageManager): Choice<string>[] {
  const list = bins.map((b) => ({ value: b, label: b }))
  if (pm !== 'npm') return list
  return [
    {
      value: NPM_DEFAULT,
      label: 'shell',
      hint: "npm's default: a subshell with node_modules/.bin on PATH",
    },
    ...list,
  ]
}

export async function execShim(argv: string[]): Promise<number> {
  const bins = listBins(process.cwd())
  if (bins.length === 0) return execNpm(argv)

  const pm = currentPm()
  const choice = await pick('Exec', execChoices(bins, pm), `${bins.length} bins`)
  if (choice === NPM_DEFAULT) return execNpm(argv)
  const args = await ask(`Arguments for ${choice}`, { placeholder: 'optional' })
  const plan = planExec(choice, args, pm)
  showCommand(plan)
  return execNpm(plan)
}
