import chalk from 'chalk'
import type { State } from '@clack/core'
import { theme } from './colors.ts'

/**
 * The prompt chrome, in the same Horizon palette as `mine` and the README artwork.
 *
 * `@clack/prompts` hardcodes cyan and green through picocolors and exposes no theming,
 * so the prompts are built on `@clack/core` instead, which renders whatever frame we
 * return. These are the pieces that frame is assembled from.
 */
const unicode =
  process.platform !== 'win32' ||
  Boolean(process.env.WT_SESSION) ||
  process.env.TERM_PROGRAM === 'vscode'
const glyph = (rich: string, plain: string) => (unicode ? rich : plain)

export const accent = chalk.hex(theme.accent)
export const good = chalk.hex(theme.green)
export const warn = chalk.hex(theme.yellow)
export const bad = chalk.hex(theme.error)
export const dim = chalk.dim
export const bold = chalk.bold

export const S = {
  active: glyph('◆', '*'),
  submit: glyph('◇', 'o'),
  cancel: glyph('■', 'x'),
  alert: glyph('▲', '!'),
  bar: glyph('│', '|'),
  barEnd: glyph('└', '—'),
  on: glyph('●', '>'),
  off: glyph('○', ' '),
  checked: glyph('◼', '[x]'),
  unchecked: glyph('◻', '[ ]'),
  more: glyph('⋮', ':'),
  spin: unicode ? ['◐', '◓', '◑', '◒'] : ['-', '\\', '|', '/'],
}

/** The step glyph for a prompt's state: accent while active, green once submitted. */
export function step(state: State): string {
  if (state === 'submit') return good(S.submit)
  if (state === 'cancel') return bad(S.cancel)
  if (state === 'error' || state === 'validating') return warn(S.alert)
  return accent(S.active)
}

export const bar = dim(S.bar)
export const barEnd = dim(S.barEnd)

/** `◆  message` — the first line of every prompt. */
export const header = (state: State, message: string): string => `${step(state)}  ${message}`

/** A body line, hung off the bar. */
export const line = (body = ''): string => `${bar}  ${body}`
