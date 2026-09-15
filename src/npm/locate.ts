import { accessSync, constants, realpathSync } from 'node:fs'
import { delimiter, join } from 'node:path'

export interface LocateOptions {
  path?: string | undefined
  self: string
  npmExecPath?: string | undefined
}

function realpath(p: string): string | undefined {
  try {
    return realpathSync(p)
  } catch {
    return undefined
  }
}

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** First executable named `name` on PATH whose real path is not bnpm itself. */
export function locateBin(name: string, opts: LocateOptions): string {
  const selfReal = realpath(opts.self)
  const names = process.platform === 'win32' ? [`${name}.cmd`, name] : [name]
  for (const dir of (opts.path ?? '').split(delimiter).filter(Boolean)) {
    for (const candidateName of names) {
      const candidate = join(dir, candidateName)
      if (!isExecutable(candidate)) continue
      const real = realpath(candidate)
      if (real && real === selfReal) continue
      return candidate
    }
  }
  if (name === 'npm' && opts.npmExecPath && isExecutable(opts.npmExecPath)) return opts.npmExecPath
  throw new Error(
    `${name} not found on PATH.${name === 'npm' ? ' Install npm or set npm_execpath.' : ''}`,
  )
}

export function locateNpm(opts: LocateOptions): string {
  return locateBin('npm', opts)
}
