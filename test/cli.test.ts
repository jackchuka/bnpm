import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { sandbox } from './helpers.ts'

describe('bnpm cli passthrough', () => {
  test.each(['SIGINT', 'SIGTERM', 'SIGHUP'])('preserves child termination by %s', (signal) => {
    const sb = sandbox()
    writeFileSync(join(sb.bin, 'npm'), `#!/bin/sh\nkill -${signal.slice(3)} $$\n`)
    const result = sb.run(['ci'])
    expect(result.signal).toBe(signal)
    expect(result.status).toBeNull()
  })

  test('preserves script flags after the separator', () => {
    const sb = sandbox()
    sb.run(['run', 'test', '--', '--plain'])
    expect(sb.recorded()).toEqual(['run', 'test', '--', '--plain'])
  })

  test('forwards argv verbatim to the real npm', () => {
    const sb = sandbox()
    const r = sb.run(['install', '--save-dev', 'lodash@^4'])
    expect(r.status).toBe(0)
    expect(sb.recorded()).toEqual(['install', '--save-dev', 'lodash@^4'])
  })

  test('propagates npm exit code', () => {
    const sb = sandbox({ npmExit: 7 })
    expect(sb.run(['ci']).status).toBe(7)
  })

  test('passes through stdout from npm', () => {
    const sb = sandbox({ npmStdout: '11.0.0\n' })
    expect(sb.run(['--version']).stdout).toBe('11.0.0\n')
  })

  test('does not prompt when stdin is not a TTY, even for `run`', () => {
    const sb = sandbox()
    const r = sb.run(['run'], { input: '' })
    expect(r.status).toBe(0)
    expect(sb.recorded()).toEqual(['run'])
  })

  test.each([
    ['run'],
    ['run-script'],
    ['uninstall'],
    ['rm'],
    ['remove'],
    ['un'],
    ['update'],
    ['up'],
    ['outdated'],
    ['deprecate'],
    ['dist-tag'],
    ['dist-tag', 'add'],
    ['view'],
    ['info'],
    ['show'],
    ['exec'],
    ['x'],
    ['link'],
    ['ln'],
    ['owner'],
    ['owner', 'add'],
    ['access'],
    ['access', 'set'],
  ])('non-TTY `npm %s` passes through verbatim with npm exit code', (...argv) => {
    const sb = sandbox({ npmExit: 3 })
    const r = sb.run(argv, { input: '' })
    expect(r.status).toBe(3)
    expect(sb.recorded()).toEqual(argv)
    expect(r.stdout).toBe('')
  })

  test('strips --plain before forwarding', () => {
    const sb = sandbox()
    sb.run(['run', '--plain'])
    expect(sb.recorded()).toEqual(['run'])
  })

  test('BNPM_PLAIN=1 disables interception', () => {
    const sb = sandbox()
    sb.run(['run'], { env: { BNPM_PLAIN: '1' } })
    expect(sb.recorded()).toEqual(['run'])
  })

  test('--bnpm-version prints own version without touching npm', () => {
    const sb = sandbox()
    const r = sb.run(['--bnpm-version'])
    expect(r.stdout.trim()).toMatch(/^bnpm \d+\.\d+\.\d+/)
    expect(sb.recorded()).toEqual([])
  })

  test('--bnpm-help lists shims and own commands without touching npm', () => {
    const sb = sandbox()
    const r = sb.run(['--bnpm-help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('mine')
    expect(r.stdout).toContain('alias')
    expect(r.stdout).toContain('run')
    expect(r.stdout).toContain('--plain')
    expect(sb.recorded()).toEqual([])
  })

  test('--pm=pnpm forwards to pnpm, not npm', () => {
    const sb = sandbox()
    const r = sb.run(['--pm=pnpm', 'install', 'zod'])
    expect(r.status).toBe(0)
    expect(sb.recordedPnpm()).toEqual(['install', 'zod'])
    expect(sb.recorded()).toEqual([])
  })

  test('BNPM_PM=pnpm does the same via the environment', () => {
    const sb = sandbox()
    sb.run(['ls'], { env: { BNPM_PM: 'pnpm' } })
    expect(sb.recordedPnpm()).toEqual(['ls'])
  })

  test('inside a pnpm project bare bnpm forwards to pnpm', () => {
    const sb = sandbox()
    writeFileSync(join(sb.root, 'pnpm-lock.yaml'), '')
    sb.run(['install'])
    expect(sb.recordedPnpm()).toEqual(['install'])
    expect(sb.recorded()).toEqual([])
  })

  test('BNPM_PM=npm pins npm even inside a pnpm project', () => {
    const sb = sandbox()
    writeFileSync(join(sb.root, 'pnpm-lock.yaml'), '')
    sb.run(['install'], { env: { BNPM_PM: 'npm' } })
    expect(sb.recorded()).toEqual(['install'])
  })

  test('alias pnpm prints a wrapper that carries the manager flag', () => {
    const sb = sandbox()
    expect(sb.run(['alias', 'pnpm']).stdout.split('\n')[0]).toBe('pnpm() { bnpm --pm=pnpm "$@" }')
    expect(sb.run(['alias', 'pnpm', 'bash']).stdout.trim()).toBe("alias pnpm='bnpm --pm=pnpm'")
    expect(sb.run(['alias', 'pnpm', 'fish']).stdout.trim()).toBe("alias pnpm 'bnpm --pm=pnpm'")
    expect(sb.run(['alias', 'fish', 'pnpm']).stdout.trim()).toBe("alias pnpm 'bnpm --pm=pnpm'")
  })

  test('mine --help and alias -h print bnpm help without touching npm', () => {
    const sb = sandbox()
    for (const argv of [
      ['mine', '--help'],
      ['alias', '-h'],
    ]) {
      const r = sb.run(argv)
      expect(r.status).toBe(0)
      expect(r.stdout).toContain('bnpm mine')
    }
    expect(sb.recorded()).toEqual([])
  })

  // zsh expands an alias before it looks up a completion, so an alias would cost npm's own
  // `npm <TAB>`; a function keeps the command word, and _bnpm forwards bnpm's own completion.
  test('alias command prints a function and completion wiring for zsh by default', () => {
    const sb = sandbox()
    const r = sb.run(['alias'])
    expect(r.stdout.trim().split('\n')).toEqual([
      'npm() { bnpm "$@" }',
      '_bnpm() { words[1]=npm; _normal }',
      '(( $+functions[compdef] )) && compdef _bnpm bnpm',
    ])
    expect(r.stdout).not.toContain('alias npm=')
    expect(sb.recorded()).toEqual([])
  })

  test('alias bash prints a plain alias, which keeps completion there', () => {
    const sb = sandbox()
    expect(sb.run(['alias', 'bash']).stdout.trim()).toBe('alias npm=bnpm')
    expect(sb.run(['alias', 'sh']).stdout.trim()).toBe('alias npm=bnpm')
  })

  test('alias fish prints fish syntax', () => {
    const sb = sandbox()
    expect(sb.run(['alias', 'fish']).stdout.trim()).toBe('alias npm bnpm')
  })
})
