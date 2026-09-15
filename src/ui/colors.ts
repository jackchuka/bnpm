import { styleText } from 'node:util'

const enabled = !process.env.NO_COLOR && process.stdout.isTTY

type Style = Parameters<typeof styleText>[0]
const wrap = (style: Style) => (s: string) => (enabled ? styleText(style, s) : s)

const pc = {
  dim: wrap('dim'),
  bold: wrap('bold'),
  red: wrap('red'),
  yellow: wrap('yellow'),
  green: wrap('green'),
  cyan: wrap('cyan'),
}

/**
 * Horizon - the same palette the README artwork is generated from, so the demo
 * SVGs read as screenshots of this screen rather than an illustration of it.
 * Mirrored in `assets/generate.mjs` (THEMES.horizon); change both together.
 *
 * Hex rather than ANSI names because the artwork is a fixed palette and the two
 * have to agree. Ink downsamples to 256/16 colours where truecolor is missing,
 * and drops colour entirely under NO_COLOR.
 */
export const theme = {
  /** headings, selection, sparkline, key hints */
  accent: '#e95678',
  green: '#29d398',
  yellow: '#fab795',
  /** Horizon's own error colour, deliberately not `accent` so the two stay apart */
  error: '#f43e5c',
} as const

export default pc
