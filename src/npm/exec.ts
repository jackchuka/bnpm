import { spawn, spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { currentPm, type PackageManager } from '../pm.ts'
import { locateBin } from './locate.ts'

const cache = new Map<PackageManager, string>()

export function binFor(pm: PackageManager): string {
  let bin = cache.get(pm)
  if (!bin) {
    bin = locateBin(pm, {
      path: process.env.PATH,
      self: process.argv[1] ?? '',
      npmExecPath: process.env.npm_execpath,
    })
    cache.set(pm, bin)
  }
  return bin
}

export function isAvailable(pm: PackageManager): boolean {
  try {
    binFor(pm)
    return true
  } catch {
    return false
  }
}

/** Hand off to the manager: inherit stdio, forward signals, exit with its code. Never resolves. */
export function execWith(pm: PackageManager, argv: string[]): Promise<never> {
  return new Promise(() => {
    const child = spawn(binFor(pm), argv, { stdio: 'inherit' })
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
    const forward = (signal: NodeJS.Signals) => {
      child.kill(signal)
    }
    for (const s of signals) process.on(s, forward)
    child.on('exit', (code, signal) => {
      // With the forwarders still installed, re-raising below would loop back here instead of exiting.
      for (const s of signals) process.off(s, forward)
      if (signal) {
        process.kill(process.pid, signal)
        return
      }
      process.exit(code ?? 1)
    })
    child.on('error', (err) => {
      process.stderr.write(`bnpm: failed to run ${pm}: ${err.message}\n`)
      process.exit(127)
    })
  })
}

/** Hand off to the manager this session is standing in for. */
export function execNpm(argv: string[]): Promise<never> {
  return execWith(currentPm(), argv)
}

/** Run the current manager and capture stdout. Stderr is inherited so OTP prompts stay visible. */
export function runNpm(argv: string[], opts: { cwd?: string } = {}): SpawnSyncReturns<string> {
  return spawnSync(binFor(currentPm()), argv, {
    cwd: opts.cwd,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  })
}

export function npmJson<T>(argv: string[], opts: { cwd?: string } = {}): T {
  const r = runNpm([...argv, '--json'], opts)
  const text = r.stdout.trim()
  if (!text) {
    if (r.status && r.status !== 0)
      throw new Error(`${currentPm()} ${argv[0]} exited with ${r.status}`)
    return {} as T
  }
  return JSON.parse(text) as T
}

/** Run a manager in the foreground with full TTY, return exit code. Used by the mine TUI. */
export function runInteractive(pm: PackageManager, argv: string[]): number {
  const r = spawnSync(binFor(pm), argv, { stdio: 'inherit' })
  return r.status ?? 1
}
