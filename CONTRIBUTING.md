# Contributing

Thanks for taking a look. Issues and pull requests are both welcome.

## Setup

```sh
npm ci
npm run check               # typecheck, lint, test, build
```

Needs Node 22.22 or newer on the 22 line, or 24.15 or newer. `npm run dev -- <args>` builds and runs bnpm with those arguments, so `npm run dev -- run` exercises the script picker.

## Scope

bnpm never reimplements npm or pnpm. A change belongs here if it turns a missing argument into a prompt, or reads from the registry to build one. Anything that would alter npm's output, exit code, or argument handling does not.

Two rules follow from that, and both are covered by tests:

- **Pass-through is byte for byte.** If the arguments are already complete, or stdout is not a terminal, or the user passed `--help`, bnpm hands argv to the real binary untouched.
- **Every write is shown first.** Registry writes end on a confirm screen printing the exact `npm …` or `pnpm …` command, and run through that binary so auth and 2FA stay the package manager's own.

## README artwork

`assets/*.svg` are generated. Edit `assets/generate.mjs` and re-run it rather than hand-editing the SVGs:

```sh
node assets/generate.mjs
```

Text is pinned with `textLength` so the terminal grid does not depend on the viewer's monospace font, and the `npm run` demo animates with declarative CSS only — that is all a browser runs when GitHub renders an SVG through an `<img>`.

## Pull requests

- Add tests for behavior changes. `vitest` covers routing, prompts, registry access, and the `mine` UI.
- Run `npm run check` before pushing; CI runs the same thing on Node 22, 24, and 26.
- Keep commits conventional (`fix(mine): …`, `feat(shims): …`), matching the existing history.
- Update the README when a command's behavior changes — its tables are the reference for what prompts and what passes through.

## Reporting bugs

Include the command you ran, the package manager and version (`npm -v`, `pnpm -v`), your Node version, and what npm did instead. If it involves a registry other than npmjs.org, say so — several features are npmjs-only by design.
