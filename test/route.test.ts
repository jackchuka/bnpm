import { describe, expect, test } from 'vitest'
import { route } from '../src/route.ts'

const tty = { interactive: true, pm: 'npm' as const }
const pipe = { interactive: false, pm: 'npm' as const }
const pnpm = { interactive: true, pm: 'pnpm' as const }

describe('route', () => {
  test('keeps plain mode for mine in a terminal', () => {
    expect(route(['mine', '--plain'], tty)).toEqual({
      kind: 'own',
      command: 'mine',
      argv: ['--plain'],
    })
  })

  test('only consumes plain before the argument separator', () => {
    expect(route(['run', 'test', '--plain', '--', '--plain'], tty)).toEqual({
      kind: 'passthrough',
      argv: ['run', 'test', '--', '--plain'],
    })
  })

  test('passes through unknown subcommands verbatim', () => {
    expect(route(['install', 'lodash'], tty)).toEqual({
      kind: 'passthrough',
      argv: ['install', 'lodash'],
    })
  })

  test('intercepts `run` with no script name when interactive', () => {
    expect(route(['run'], tty)).toEqual({ kind: 'shim', shim: 'run', argv: ['run'] })
  })

  test('does not intercept `run` when a script is given', () => {
    expect(route(['run', 'build'], tty)).toEqual({ kind: 'passthrough', argv: ['run', 'build'] })
  })

  test('does not intercept `run` when only flags follow (npm run --if-present is a listing)', () => {
    expect(route(['run', '--json'], tty)).toEqual({ kind: 'passthrough', argv: ['run', '--json'] })
  })

  test('never intercepts when not interactive', () => {
    expect(route(['run'], pipe)).toEqual({ kind: 'passthrough', argv: ['run'] })
  })

  test('--plain forces passthrough and is stripped', () => {
    expect(route(['run', '--plain'], tty)).toEqual({ kind: 'passthrough', argv: ['run'] })
  })

  test('maps aliases: rm/remove/un → uninstall, up → update, info/show → view', () => {
    expect(route(['rm'], tty)).toMatchObject({ kind: 'shim', shim: 'uninstall' })
    expect(route(['up'], tty)).toMatchObject({ kind: 'shim', shim: 'update' })
    expect(route(['info'], tty)).toMatchObject({ kind: 'shim', shim: 'view' })
  })

  test('intercepts outdated as the update shim', () => {
    expect(route(['outdated'], tty)).toMatchObject({ kind: 'shim', shim: 'update' })
  })

  test('intercepts deprecate with no args, but not with a spec', () => {
    expect(route(['deprecate'], tty)).toMatchObject({ kind: 'shim', shim: 'deprecate' })
    expect(route(['deprecate', 'foo@1', 'msg'], tty)).toMatchObject({ kind: 'passthrough' })
  })

  test('intercepts dist-tag with no args and with bare add/rm', () => {
    expect(route(['dist-tag'], tty)).toMatchObject({ kind: 'shim', shim: 'dist-tag' })
    expect(route(['dist-tag', 'add'], tty)).toMatchObject({ kind: 'shim', shim: 'dist-tag' })
    expect(route(['dist-tag', 'ls'], tty)).toMatchObject({ kind: 'passthrough' })
  })

  test('intercepts bare exec/x and link/ln, which npm otherwise runs with defaults', () => {
    expect(route(['exec'], tty)).toMatchObject({ kind: 'shim', shim: 'exec' })
    expect(route(['x'], tty)).toMatchObject({ kind: 'shim', shim: 'exec' })
    expect(route(['link'], tty)).toMatchObject({ kind: 'shim', shim: 'link' })
    expect(route(['ln'], tty)).toMatchObject({ kind: 'shim', shim: 'link' })
    expect(route(['exec', '--', 'vitest'], tty)).toMatchObject({ kind: 'passthrough' })
    expect(route(['link', 'lodash'], tty)).toMatchObject({ kind: 'passthrough' })
    expect(route(['link', '-g'], tty)).toMatchObject({ kind: 'passthrough' })
  })

  test('under pnpm, update/outdated are bypassed; pnpm ships update -i', () => {
    for (const cmd of ['update', 'up', 'outdated']) {
      expect(route([cmd], pnpm)).toEqual({ kind: 'passthrough', argv: [cmd] })
    }
  })

  test('under pnpm, run/remove/exec and their pnpm aliases still prompt', () => {
    for (const cmd of ['run', 'run-script']) {
      expect(route([cmd], pnpm)).toMatchObject({ kind: 'shim', shim: 'run' })
    }
    for (const cmd of ['remove', 'rm', 'un', 'uninstall']) {
      expect(route([cmd], pnpm)).toMatchObject({ kind: 'shim', shim: 'uninstall' })
    }
    for (const cmd of ['exec', 'x']) {
      expect(route([cmd], pnpm)).toMatchObject({ kind: 'shim', shim: 'exec' })
    }
  })

  test('under pnpm, bare link/ln prompt for a path (pnpm errors without one)', () => {
    expect(route(['link'], pnpm)).toMatchObject({ kind: 'shim', shim: 'link' })
    expect(route(['ln'], pnpm)).toMatchObject({ kind: 'shim', shim: 'link' })
    expect(route(['link', '../lib'], pnpm)).toMatchObject({ kind: 'passthrough' })
  })

  test('under pnpm, `unlink` is its own shim; under npm it stays a remove alias', () => {
    expect(route(['unlink'], pnpm)).toMatchObject({ kind: 'shim', shim: 'unlink' })
    expect(route(['unlink', 'lib'], pnpm)).toMatchObject({ kind: 'passthrough' })
    expect(route(['unlink'], tty)).toMatchObject({ kind: 'shim', shim: 'uninstall' })
  })

  test('under pnpm the publisher shims still prompt', () => {
    expect(route(['deprecate'], pnpm)).toMatchObject({ kind: 'shim', shim: 'deprecate' })
    expect(route(['dist-tag'], pnpm)).toMatchObject({ kind: 'shim', shim: 'dist-tag' })
    expect(route(['view'], pnpm)).toMatchObject({ kind: 'shim', shim: 'view' })
    expect(route(['mine'], pnpm)).toMatchObject({ kind: 'own', command: 'mine' })
  })

  test('bare docs/home/repo/bugs/issues prompt for a package; with a name they pass through', () => {
    for (const cmd of ['docs', 'home', 'repo', 'bugs', 'issues']) {
      expect(route([cmd], tty)).toMatchObject({ kind: 'shim', shim: 'open' })
      expect(route([cmd, 'lodash'], tty)).toMatchObject({ kind: 'passthrough' })
    }
  })

  test('under pnpm, docs, repo, bugs, and issues all prompt (pnpm 12 implements them)', () => {
    for (const cmd of ['docs', 'home', 'repo', 'bugs', 'issues']) {
      expect(route([cmd], pnpm)).toMatchObject({ kind: 'shim', shim: 'open' })
    }
  })

  test('owner: bare, or add/rm missing arguments, prompts; ls and complete forms pass through', () => {
    expect(route(['owner'], tty)).toMatchObject({ kind: 'shim', shim: 'owner' })
    expect(route(['owner', 'add'], tty)).toMatchObject({ kind: 'shim', shim: 'owner' })
    expect(route(['owner', 'rm', 'bob'], tty)).toMatchObject({ kind: 'shim', shim: 'owner' })
    expect(route(['owner', 'ls'], tty)).toMatchObject({ kind: 'passthrough' })
    expect(route(['owner', 'add', 'bob', '@s/a'], tty)).toMatchObject({ kind: 'passthrough' })
  })

  test('access: bare, or set without a package, prompts; get/list/grant pass through', () => {
    expect(route(['access'], tty)).toMatchObject({ kind: 'shim', shim: 'access' })
    expect(route(['access', 'set'], tty)).toMatchObject({ kind: 'shim', shim: 'access' })
    expect(route(['access', 'set', 'status=public'], tty)).toMatchObject({
      kind: 'shim',
      shim: 'access',
    })
    expect(route(['access', 'set', 'status=public', '@s/a'], tty)).toMatchObject({
      kind: 'passthrough',
    })
    expect(route(['access', 'get', 'status'], tty)).toMatchObject({ kind: 'passthrough' })
    expect(route(['access', 'list', 'packages'], tty)).toMatchObject({ kind: 'passthrough' })
  })

  test('under pnpm, owner and access prompt too (they run through npm)', () => {
    expect(route(['owner'], pnpm)).toMatchObject({ kind: 'shim', shim: 'owner' })
    expect(route(['access'], pnpm)).toMatchObject({ kind: 'shim', shim: 'access' })
  })

  test.each([
    ['run', '-h'],
    ['run', '--help'],
    ['dist-tag', '--help'],
    ['dist-tag', 'add', '-h'],
    ['owner', '-h'],
    ['access', 'set', '--help'],
    ['deprecate', '-?'],
    ['exec', '--help'],
  ])('%s %s asks for help, so it passes through untouched', (...argv) => {
    expect(route(argv, tty)).toEqual({ kind: 'passthrough', argv })
  })

  test('help on a bnpm-only command stays with bnpm (npm has no such command)', () => {
    expect(route(['mine', '--help'], tty)).toEqual({
      kind: 'own',
      command: 'mine',
      argv: ['--help'],
    })
  })

  test('routes bnpm-only commands even when not interactive', () => {
    expect(route(['mine'], pipe)).toEqual({ kind: 'own', command: 'mine', argv: [] })
    expect(route(['alias', 'fish'], pipe)).toEqual({
      kind: 'own',
      command: 'alias',
      argv: ['fish'],
    })
  })

  test('empty argv passes through (npm prints its usage)', () => {
    expect(route([], tty)).toEqual({ kind: 'passthrough', argv: [] })
  })
})

describe('bare -i opens the menu', () => {
  test('on its own in a terminal', () => {
    expect(route(['-i'], tty)).toEqual({ kind: 'own', command: 'menu', argv: [] })
    expect(route(['--interactive'], tty)).toEqual({ kind: 'own', command: 'menu', argv: [] })
  })

  test('never off a terminal, so pipes and CI keep the manager', () => {
    expect(route(['-i'], pipe)).toEqual({ kind: 'passthrough', argv: ['-i'] })
  })

  test('--plain hands it back to the manager', () => {
    expect(route(['-i', '--plain'], tty)).toEqual({ kind: 'passthrough', argv: ['-i'] })
  })

  test('alongside anything else it is an argument, not the menu', () => {
    expect(route(['install', '-i'], tty)).toEqual({ kind: 'passthrough', argv: ['install', '-i'] })
    expect(route(['-i', 'lodash'], tty)).toEqual({ kind: 'passthrough', argv: ['-i', 'lodash'] })
  })
})
