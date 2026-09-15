import { bnpmArgs, route } from './route.ts'
import { errorMessage } from './errors.ts'
import { execNpm } from './npm/exec.ts'
import { version } from './version.ts'
import { isInteractive } from './interactive.ts'
import { resolvePm, setPm } from './pm.ts'

async function main(rawArgv: string[]): Promise<number> {
  const { pm, argv } = resolvePm(rawArgv, process.env)
  setPm(pm)
  if (argv[0] === '--bnpm-version') {
    process.stdout.write(`bnpm ${version()}\n`)
    return 0
  }
  if (argv[0] === '--bnpm-help') return (await import('./commands/help.ts')).helpCommand()
  const interactive = isInteractive({
    stdinTTY: Boolean(process.stdin.isTTY),
    stdoutTTY: Boolean(process.stdout.isTTY),
    env: process.env,
  })
  const r = route(argv, { interactive, pm })

  switch (r.kind) {
    case 'passthrough':
      return execNpm(r.argv)
    case 'own':
      if (bnpmArgs(r.argv).some((a) => a === '-h' || a === '--help' || a === '-?'))
        return (await import('./commands/help.ts')).helpCommand()
      if (r.command === 'alias') return (await import('./commands/alias.ts')).aliasCommand(r.argv)
      if (r.command === 'menu') return (await import('./commands/menu.ts')).menuCommand()
      return (await import('./mine/index.ts')).mineCommand(r.argv)
    case 'shim':
      return (await import('./shims/index.ts')).runShim(r.shim, r.argv)
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    // Let stdout drain instead of calling process.exit, which truncates piped output.
    process.exitCode = code
  },
  (err: unknown) => {
    process.stderr.write(`bnpm: ${errorMessage(err)}\n`)
    process.exit(1)
  },
)
