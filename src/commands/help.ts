export const HELP = `bnpm — npm with an interactive layer

Usage: bnpm <command> [args]            runs your project's package manager (npm or pnpm, detected
                                        from packageManager / lockfile); prompts when args are missing
       bnpm --pm=pnpm <command>         force a manager (or BNPM_PM=…)
       bnpm -i                          menu of the commands bnpm prompts for
       bnpm mine [--json|--plain]       browse and manage the packages you publish
       bnpm alias [npm|pnpm] [shell]    print the shell setup (shell: zsh, bash, fish, nu, pwsh)

Project layer (prompts from package.json, TTY only, when arguments are missing):
  (under pnpm: run, remove, exec, link, unlink; pnpm has update -i)
  run                 pick a script
  uninstall, rm       multi-select installed dependencies
  update, outdated    pick outdated packages and a target (wanted/latest)
  exec, x             pick a bin from node_modules/.bin, npm's own shell first (npm default)
  link, ln            npm: a globally linked package, linking this one first (npm default)
                      pnpm: a sibling directory to link, or type a path
  unlink              pnpm: a linked dependency to drop, everything first (pnpm default)

Publisher layer (prompts from your registry account; works under npm and pnpm):
  deprecate           package → version or range → message → confirm
  dist-tag            package → ls (npm default) / add / rm
  owner               package → current owners shown → add (type a user) / rm (pick one) → confirm
  access              package → current status shown → the other status first → confirm
  view, info          current package (npm default), project dependencies, your packages;
                      then terminal, npmjs.com, repository, or homepage
  docs, repo, bugs    same package picker, then open in the browser
  mine                full TUI for everything above plus owners, access, unpublish
                      (owners/access run through npm when present: pnpm's fail on npmjs.org)

Escape hatches:
  --plain             forward this call to the package manager untouched
  BNPM_PLAIN=1        disable prompts for the whole session
  -h, --help          on any command: the manager's own help, never a prompt
  Non-TTY stdin/stdout, CI environments (CI, GITHUB_ACTIONS, …), and TERM=dumb never prompt.

Own flags:
  --pm=npm|pnpm       which package manager to stand in for (or BNPM_PM); default: detected, else npm
  --bnpm-version      print bnpm's version
  --bnpm-help         this text (plain --help goes to npm)
`

export function helpCommand(): number {
  process.stdout.write(HELP)
  return 0
}
