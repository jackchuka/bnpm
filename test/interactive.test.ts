import { describe, expect, test } from 'vitest'
import { isInteractive } from '../src/interactive.ts'

const tty = { stdinTTY: true, stdoutTTY: true }

describe('isInteractive', () => {
  test('true only with both stdin and stdout on a TTY', () => {
    expect(isInteractive({ ...tty, env: {} })).toBe(true)
    expect(isInteractive({ stdinTTY: false, stdoutTTY: true, env: {} })).toBe(false)
    expect(isInteractive({ stdinTTY: true, stdoutTTY: false, env: {} })).toBe(false)
  })

  test('BNPM_PLAIN=1 disables prompts', () => {
    expect(isInteractive({ ...tty, env: { BNPM_PLAIN: '1' } })).toBe(false)
  })

  test('CI environments never prompt, even with a pseudo-TTY attached', () => {
    expect(isInteractive({ ...tty, env: { CI: 'true' } })).toBe(false)
    expect(isInteractive({ ...tty, env: { GITHUB_ACTIONS: 'true' } })).toBe(false)
    expect(isInteractive({ ...tty, env: { CI: '' } })).toBe(true)
  })

  test('TERM=dumb disables prompts', () => {
    expect(isInteractive({ ...tty, env: { TERM: 'dumb' } })).toBe(false)
  })
})
