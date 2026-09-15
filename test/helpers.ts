import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'

export const CLI = join(import.meta.dirname, '..', 'src', 'cli.ts')

export interface Sandbox {
  root: string
  bin: string
  log: string
  run: (
    argv: string[],
    opts?: { env?: Record<string, string>; cwd?: string; input?: string },
  ) => SpawnSyncReturns<string>
  recorded: () => string[]
  recordedPnpm: () => string[]
}

export function sandbox(opts: { npmExit?: number; npmStdout?: string } = {}): Sandbox {
  const root = mkdtempSync(join(tmpdir(), 'bnpm-it-'))
  const bin = join(root, 'bin')
  const log = join(root, 'npm.log')
  mkdirSync(bin)
  // Both fake managers record their argv, one per line, into their own log.
  for (const name of ['npm', 'pnpm']) {
    const fake = join(bin, name)
    writeFileSync(
      fake,
      `#!/bin/sh
printf '%s\\n' "$@" >> "${join(root, `${name}.log`)}"
${opts.npmStdout ? `printf '%s' '${opts.npmStdout.replaceAll("'", "'\\''")}'` : ''}
exit ${opts.npmExit ?? 0}
`,
    )
    chmodSync(fake, 0o755)
  }
  const run: Sandbox['run'] = (argv, o = {}) =>
    spawnSync(process.execPath, [CLI, ...argv], {
      encoding: 'utf8',
      cwd: o.cwd ?? root,
      input: o.input,
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: root,
        NO_COLOR: '1',
        ...o.env,
      },
    })
  const recorded = () => {
    try {
      return readFileSync(log, 'utf8').split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  const recordedPnpm = () => {
    try {
      return readFileSync(join(root, 'pnpm.log'), 'utf8').split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  return { root, bin, log, run, recorded, recordedPnpm }
}
