// Source of truth for the README artwork. Regenerate with `node assets/generate.mjs`.
//
// The SVGs are built rather than hand-written so the terminal grid stays exact:
// every string is pinned with textLength, so alignment never depends on the
// viewer's monospace font. Animation is declarative CSS only, which is all that
// runs when GitHub renders an SVG through an <img> in secure animated mode.
//
//   node assets/generate.mjs                 write the active theme to assets/
//   node assets/generate.mjs --all <dir>     write every theme to <dir> for comparison
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Terminal palettes. `accent` carries the identity: the `b` in the wordmark and the cursor. */
export const THEMES = {
  midnight: {
    bg: '#0d1117',
    bg2: '#161b26',
    bar: '#1b2130',
    line: '#272e3d',
    fg: '#c9d1d9',
    dim: '#6e7681',
    dim2: '#4d5666',
    accent: '#56d4dd',
    green: '#7ee787',
    yellow: '#e3b341',
    red: '#f85149',
  },
  dracula: {
    bg: '#282a36',
    bg2: '#343746',
    bar: '#21222c',
    line: '#44475a',
    fg: '#f8f8f2',
    dim: '#9ca0b8',
    dim2: '#6272a4',
    accent: '#bd93f9',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    red: '#ff5555',
  },
  tokyonight: {
    bg: '#1a1b26',
    bg2: '#24283b',
    bar: '#16161e',
    line: '#2f3549',
    fg: '#c0caf5',
    dim: '#787c99',
    dim2: '#565f89',
    accent: '#7aa2f7',
    green: '#9ece6a',
    yellow: '#e0af68',
    red: '#f7768e',
  },
  catppuccin: {
    bg: '#1e1e2e',
    bg2: '#28283e',
    bar: '#181825',
    line: '#313244',
    fg: '#cdd6f4',
    dim: '#9399b2',
    dim2: '#6c7086',
    accent: '#cba6f7',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    red: '#f38ba8',
  },
  nord: {
    bg: '#2e3440',
    bg2: '#3b4252',
    bar: '#272c36',
    line: '#434c5e',
    fg: '#eceff4',
    dim: '#a0a8b7',
    dim2: '#7b8494',
    accent: '#88c0d0',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    red: '#bf616a',
  },
  gruvbox: {
    bg: '#282828',
    bg2: '#32302f',
    bar: '#1d2021',
    line: '#3c3836',
    fg: '#ebdbb2',
    dim: '#a89984',
    dim2: '#7c6f64',
    accent: '#fe8019',
    green: '#b8bb26',
    yellow: '#fabd2f',
    red: '#fb4934',
  },
  rosepine: {
    bg: '#191724',
    bg2: '#1f1d2e',
    bar: '#15131f',
    line: '#2a2837',
    fg: '#e0def4',
    dim: '#908caa',
    dim2: '#6e6a86',
    accent: '#ebbcba',
    green: '#9ccfd8',
    yellow: '#f6c177',
    red: '#eb6f92',
  },
  solarized: {
    bg: '#002b36',
    bg2: '#073642',
    bar: '#00212b',
    line: '#0b4a5a',
    fg: '#93a1a1',
    dim: '#657b83',
    dim2: '#587177',
    accent: '#2aa198',
    green: '#859900',
    yellow: '#b58900',
    red: '#dc322f',
  },
  onedark: {
    bg: '#282c34',
    bg2: '#31353f',
    bar: '#21252b',
    line: '#3e4451',
    fg: '#abb2bf',
    dim: '#7f8794',
    dim2: '#5c6370',
    accent: '#61afef',
    green: '#98c379',
    yellow: '#e5c07b',
    red: '#e06c75',
  },
  monokai: {
    bg: '#2d2a2e',
    bg2: '#383539',
    bar: '#221f22',
    line: '#403e41',
    fg: '#fcfcfa',
    dim: '#939293',
    dim2: '#727072',
    accent: '#ffd866',
    green: '#a9dc76',
    yellow: '#ffd866',
    red: '#ff6188',
  },
  everforest: {
    bg: '#2d353b',
    bg2: '#343f44',
    bar: '#272e33',
    line: '#3d484d',
    fg: '#d3c6aa',
    dim: '#9da9a0',
    dim2: '#7a8478',
    accent: '#a7c080',
    green: '#a7c080',
    yellow: '#dbbc7f',
    red: '#e67e80',
  },
  kanagawa: {
    bg: '#1f1f28',
    bg2: '#2a2a37',
    bar: '#16161d',
    line: '#363646',
    fg: '#dcd7ba',
    dim: '#9a9aa7',
    dim2: '#727169',
    accent: '#7e9cd8',
    green: '#98bb6c',
    yellow: '#e6c384',
    red: '#e46876',
  },
  ayu: {
    bg: '#1f2430',
    bg2: '#272d3d',
    bar: '#1a1f29',
    line: '#343b4d',
    fg: '#cbccc6',
    dim: '#8a9199',
    dim2: '#5c6773',
    accent: '#ffcc66',
    green: '#bae67e',
    yellow: '#ffd580',
    red: '#f28779',
  },
  nightowl: {
    bg: '#011627',
    bg2: '#0b2942',
    bar: '#001122',
    line: '#1d3b53',
    fg: '#d6deeb',
    dim: '#8badc1',
    dim2: '#5f7e97',
    accent: '#82aaff',
    green: '#addb67',
    yellow: '#ecc48d',
    red: '#ef5350',
  },
  horizon: {
    bg: '#1c1e26',
    bg2: '#232530',
    bar: '#16161c',
    line: '#2e303e',
    fg: '#d5d8da',
    dim: '#9a9ca8',
    dim2: '#6c6f93',
    accent: '#e95678',
    green: '#29d398',
    yellow: '#fab795',
    red: '#e95678',
  },
  vitesse: {
    bg: '#121212',
    bg2: '#1b1b1b',
    bar: '#0d0d0d',
    line: '#2a2a2a',
    fg: '#dbd7ca',
    dim: '#8c8c8c',
    dim2: '#5c5c5c',
    accent: '#4d9375',
    green: '#4d9375',
    yellow: '#d4976c',
    red: '#cb7676',
  },
  synthwave: {
    bg: '#241b2f',
    bg2: '#2d2140',
    bar: '#1c1528',
    line: '#3d2f52',
    fg: '#f8f8f2',
    dim: '#b8a6d9',
    dim2: '#7a6a99',
    accent: '#ff7edb',
    green: '#72f1b8',
    yellow: '#fede5d',
    red: '#fe4450',
  },
  matrix: {
    bg: '#0b0f0b',
    bg2: '#101810',
    bar: '#070a07',
    line: '#1c2a1c',
    fg: '#b6f7c1',
    dim: '#4e9e63',
    dim2: '#2f6b42',
    accent: '#00ff9c',
    green: '#00ff9c',
    yellow: '#9dff6a',
    red: '#ff5f56',
  },
  amber: {
    bg: '#17120a',
    bg2: '#1f1810',
    bar: '#120e08',
    line: '#2e2415',
    fg: '#ffcf70',
    dim: '#b08033',
    dim2: '#7a5a24',
    accent: '#ffb000',
    green: '#d6c14a',
    yellow: '#ffb000',
    red: '#ff6b35',
  },
  latte: {
    light: true,
    bg: '#eff1f5',
    bg2: '#e6e9ef',
    bar: '#dce0e8',
    line: '#ccd0da',
    fg: '#4c4f69',
    dim: '#6c6f85',
    dim2: '#8c8fa1',
    accent: '#8839ef',
    green: '#40a02b',
    yellow: '#df8e1d',
    red: '#d20f39',
  },
  dawn: {
    light: true,
    bg: '#faf4ed',
    bg2: '#fffaf3',
    bar: '#f2e9e1',
    line: '#dfdad9',
    fg: '#575279',
    dim: '#797593',
    dim2: '#9893a5',
    accent: '#d7827e',
    green: '#56949f',
    yellow: '#ea9d34',
    red: '#b4637a',
  },
  paper: {
    light: true,
    bg: '#ffffff',
    bg2: '#f6f8fa',
    bar: '#eaeef2',
    line: '#d0d7de',
    fg: '#1f2328',
    dim: '#656d76',
    dim2: '#8c959f',
    accent: '#0969da',
    green: '#1a7f37',
    yellow: '#9a6700',
    red: '#cf222e',
  },
}

/** The theme the committed assets/*.svg are built from. */
export const ACTIVE = 'horizon'

const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'DejaVu Sans Mono', monospace"
const CW = 8.4 // char advance at font-size 14
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const PAD = 20
const col = (n, pad = PAD) => +(pad + n * CW).toFixed(1)
const rowY = (i) => 170 + i * 22
const defs = (w, h) => `
  <defs>
    <clipPath id="body"><rect x="1" y="33" width="${w - 2}" height="${h - 34}" rx="10"/></clipPath>
  </defs>`

/**
 * Daily downloads for the 30 days ending 2026-09-13 - the series the detail pane
 * describes, not decoration. Weekends sit at roughly 43% of a weekday, which is the
 * shape every npm package shows. The pane's two figures are derived from these
 * numbers: all 30 total 22,000 (22k/mo) and the last 7 total 5,201 (5.2k/wk).
 */
const DOWNLOADS = [
  401, 378, 961, 852, 915, 888, 952, 374, 397, 970, 842, 906, 942, 879, 394, 370, 979, 897, 924,
  870, 952, 390, 366, 904, 860, 931, 852, 887, 393, 374,
]

/** monospace text pinned to an exact column width so the grid never depends on the viewer's font */
const t = (s, x, y, fill, extra = '') => {
  const n = [...s].length
  return `<text x="${x}" y="${y}" fill="${fill}" textLength="${(n * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs"${extra ? ' ' + extra : ''}>${esc(s)}</text>`
}

export function build(C, out) {
  mkdirSync(out, { recursive: true })

  const chrome = (w, h, title) => `
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="11" fill="${C.bg}" stroke="${C.line}"/>
  <path d="M0.5 11.5a11 11 0 0 1 11-11h${w - 23}a11 11 0 0 1 11 11V32H0.5z" fill="${C.bar}"/>
  <line x1="0.5" y1="32" x2="${w - 0.5}" y2="32" stroke="${C.line}"/>
  <circle cx="20" cy="16.5" r="4.5" fill="#f05c54"/>
  <circle cx="36" cy="16.5" r="4.5" fill="#e0b13a"/>
  <circle cx="52" cy="16.5" r="4.5" fill="#4ec26a"/>
  <text x="${w / 2}" y="21" fill="${C.dim2}" font-size="11.5" text-anchor="middle">${esc(title)}</text>`

  const hr = (y, w) => `<line x1="${PAD}" y1="${y}" x2="${w - PAD}" y2="${y}" stroke="${C.line}"/>`

  // ---- banner --------------------------------------------------------------
  {
    const W = 1000,
      H = 270
    const MW = 55.2
    const markX = 375,
      markW = 4 * MW
    writeFileSync(
      join(out, 'banner.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="bnpm - Better (p)npm. The same npm or pnpm, with an interactive layer on top.">
  <defs>
    <style>
      @keyframes blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      .cursor { animation: blink 1.1s steps(1) infinite }
      @media (prefers-reduced-motion: reduce) { .cursor { animation: none } }
    </style>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="${C.light ? C.bg2 : C.bg}"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${C.line}"/>

  <text x="${markX}" y="140" font-size="92" font-weight="700" textLength="${markW}" lengthAdjust="spacingAndGlyphs">
    <tspan fill="${C.accent}">b</tspan><tspan fill="${C.fg}">npm</tspan>
  </text>
  <rect class="cursor" x="${markX + markW + 12}" y="79" width="20" height="64" rx="2" fill="${C.accent}" opacity="0.9"/>

  <text x="${W / 2}" y="192" font-size="21" font-weight="600" fill="${C.fg}" text-anchor="middle">Better (p)npm.</text>
  <text x="${W / 2}" y="220" font-size="14.5" fill="${C.dim}" text-anchor="middle">The same npm or pnpm, with an interactive layer on top.</text>
  <text x="${W / 2}" y="243" font-size="14.5" fill="${C.dim2}" text-anchor="middle">Missing arguments turn into prompts. Nothing else changes.</text>
</svg>
`,
    )
  }

  // ---- animated `npm run` demo --------------------------------------------
  {
    const W = 620,
      H = 400
    const NAME = col(5),
      CMD = col(17),
      MARK = col(3)
    const list = [
      ['build', 'vite build'],
      ['dev', 'vite dev'],
      ['lint', 'eslint .'],
      ['format', 'prettier --write .'],
      ['start', 'node server.js'],
    ]
      .map(([n, c], i) => {
        const y = rowY(i),
          sel = i === 0
        return `      ${t('\u2502', col(0), y, C.dim2)}
      ${t(sel ? '\u25cf' : '\u25cb', MARK, y, sel ? C.accent : C.dim2)}
      ${t(n, NAME, y, sel ? C.accent : C.dim, sel ? 'font-weight="600"' : '')}
      ${t(c, CMD, y, C.dim2)}`
      })
      .join('\n')

    writeFileSync(
      join(out, 'demo-run.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="14" role="img" aria-label="Typing npm run opens a fuzzy script picker; filtering to te selects test and runs npm run test.">
  ${defs(W, H)}
  <defs>
    <clipPath id="tc1"><rect class="t1" x="${col(2) - 58.8}" y="62" width="58.8" height="23"/></clipPath>
    <clipPath id="tc2"><rect class="t2" x="${col(11) - 16.8}" y="126" width="16.8" height="23"/></clipPath>
  </defs>
  <style>
    text { white-space: pre }
    @keyframes type1 { 0%,3% { transform: translateX(0) } 12%,100% { transform: translateX(58.8px) } }
    @keyframes type2 { 0%,22% { transform: translateX(0) } 26%,100% { transform: translateX(16.8px) } }
    @keyframes caret1 { 0%,2%{opacity:0} 3%,12%{opacity:.85} 13%,100%{opacity:0} }
    @keyframes caret2 { 0%,15%{opacity:0} 16%,27%{opacity:.85} 28%,100%{opacity:0} }
    @keyframes appear  { 0%,14.5%{opacity:0} 16.5%,94%{opacity:1} 99%,100%{opacity:0} }
    @keyframes unfilt  { 0%,14.5%{opacity:0} 16.5%,27.5%{opacity:1} 29.5%,100%{opacity:0} }
    @keyframes filt    { 0%,29%{opacity:0} 31%,94%{opacity:1} 99%,100%{opacity:0} }
    @keyframes result  { 0%,35%{opacity:0} 37.5%,94%{opacity:1} 99%,100%{opacity:0} }
    @keyframes cmdline { 0%,2%{opacity:0} 3%,94%{opacity:1} 99%,100%{opacity:0} }
    .t1 { animation: type1 10s steps(7) infinite }
    .t2 { animation: type2 10s steps(2) infinite }
    .c1 { animation: caret1 10s infinite }
    .c2 { animation: caret2 10s infinite }
    .ap { animation: appear 10s infinite }
    .uf { animation: unfilt 10s infinite }
    .fl { animation: filt   10s infinite }
    .rs { animation: result 10s infinite }
    .cl { animation: cmdline 10s infinite }
    @media (prefers-reduced-motion: reduce) {
      .t1 { animation: none; transform: translateX(58.8px) }
      .t2 { animation: none; transform: translateX(16.8px) }
      .c1,.c2 { animation: none; opacity: 0 }
      .ap,.fl,.rs,.cl { animation: none; opacity: 1 }
      .uf { animation: none; opacity: 0 }
    }
  </style>
  ${chrome(W, H, 'zsh \u2014 my-app')}
  <g clip-path="url(#body)">

    <g class="cl">
      ${t('$', col(0), 78, C.green)}
      <g clip-path="url(#tc1)">${t('npm run', col(2), 78, C.fg)}</g>
    </g>
    <g class="t1">
      <rect class="c1" x="${col(2)}" y="64" width="8.4" height="19" rx="1" fill="${C.accent}"/>
    </g>

    <g class="ap">
      ${t('\u25c6', col(0), 118, C.accent)}
      ${t('Run script', col(3), 118, C.fg, 'font-weight="600"')}
      ${t('my-app \u00b7 8 scripts', col(15), 118, C.dim)}
      ${t('\u2502', col(0), 142, C.dim2)}
      ${t('Search:', col(3), 142, C.dim)}
      <g clip-path="url(#tc2)">${t('te', col(11), 142, C.fg)}</g>
    </g>
    <g class="t2">
      <rect class="c2" x="${col(11)}" y="128" width="8.4" height="19" rx="1" fill="${C.accent}"/>
    </g>
    <g class="fl">${t('(1 match)', col(16), 142, C.dim2)}</g>

    <g class="uf">
${list}
      ${t('\u2514', col(0), rowY(5) + 2, C.dim2)}
    </g>

    <g class="fl">
      ${t('\u2502', col(0), 170, C.dim2)}
      ${t('\u25cf', MARK, 170, C.accent)}
      ${t('test', NAME, 170, C.accent, 'font-weight="600"')}
      ${t('vitest run', CMD, 170, C.dim2)}
      ${t('\u2514', col(0), 194, C.dim2)}
    </g>

    <g class="rs">
      ${t('\u25c7', col(0), 230, C.green)}
      ${t('$ npm run test', col(3), 230, C.fg)}
    </g>
  </g>
</svg>
`,
    )
  }

  // ---- static `npm mine` screen -------------------------------------------
  {
    const W = 620,
      H = 400
    const SX = 262,
      SBASE = 260,
      SMAX = 16
    const peak = Math.max(...DOWNLOADS)
    const bars = DOWNLOADS.map((v, i) => {
      const h = Math.max(2, (v / peak) * SMAX)
      return `<rect x="${SX + i * 6}" y="${(SBASE - h).toFixed(1)}" width="4" height="${h.toFixed(1)}" rx="1" fill="${C.accent}" opacity="0.85"/>`
    }).join('')

    const CP = col(2),
      CL = 220,
      CT = 292,
      CP2 = 336,
      CD = 432,
      CF = 490
    const rows = [
      ['@scope/sdk', '2.15.0', '4', '4d ago', '5.2k', '', true],
      ['@scope/ui', '1.14.0', '1', '4d ago', '4.7k', '', false],
      ['@scope/legacy', '0.6.0', '1', '6mo ago', '371', 'deprecated', false],
    ]
      .map(([n, l, tg, pub, dl, flag, sel], i) => {
        const y = 133 + i * 22
        const fg = sel ? C.fg : C.dim
        const b = sel ? 'font-weight="600"' : ''
        return `    ${sel ? t('\u25b8', col(0), y, C.accent) : ''}
    ${t(n, CP, y, C.fg, b)}
    ${t(l, CL, y, fg, b)}
    ${t(tg, CT, y, sel ? C.fg : C.dim, b)}
    ${t(pub, CP2, y, sel ? C.fg : C.dim, b)}
    ${t(dl, CD, y, fg, b)}
    ${flag ? t(flag, CF, y, C.yellow, b) : ''}`
      })
      .join('\n')

    const keyRow = (keys, y) => {
      let kx = PAD
      return keys
        .map(([k, label]) => {
          const a = t(k, kx, y, C.accent, 'font-weight="600"')
          const b = t(label, kx + k.length * CW + CW, y, C.dim2)
          kx += (k.length + 1 + label.length + 3) * CW
          return a + b
        })
        .join('\n    ')
    }

    writeFileSync(
      join(out, 'demo-mine.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="14" role="img" aria-label="bnpm mine: a terminal UI listing the packages your npm account can publish, with versions, dist-tags, download sparkline and maintainers.">
  ${defs(W, H)}
  <style>text { white-space: pre }</style>
  ${chrome(W, H, 'zsh \u2014 bnpm mine')}
  <g clip-path="url(#body)">
    ${t('bnpm mine', col(0), 68, C.accent, 'font-weight="600"')}
    ${t('\u00b7 you \u00b7 22 packages \u00b7 sort: downloads', col(10), 68, C.dim)}
    ${hr(84, W)}

    ${t('Package', CP, 106, C.dim2)}
    ${t('Latest', CL, 106, C.dim2)}
    ${t('Tags', CT, 106, C.dim2)}
    ${t('Published', CP2, 106, C.dim2)}
    ${t('\u2193/wk', CD, 106, C.dim2)}

${rows}
    ${hr(196, W)}

    ${t('@scope/sdk', col(0), 220, C.fg, 'font-weight="600"')}
    <text x="${W - PAD}" y="220" fill="${C.dim}" text-anchor="end">read-write</text>

    ${t('latest', col(0), 242, C.dim)}${t('2.15.0', col(7), 242, C.fg)}${t('\u00b7 next', col(14), 242, C.dim)}${t('2.16.0-beta.1', col(21), 242, C.fg)}${t('\u00b7 v1', col(35), 242, C.dim)}${t('1.85.1', col(40), 242, C.fg)}

    ${t('downloads', col(0), 264, C.dim)}${t('5.2k/wk \u00b7 22k/mo', col(10), 264, C.fg)}
    ${bars}

    ${t('versions', col(0), 286, C.dim)}${t('227', col(9), 286, C.fg)}${t('\u00b7 first', col(13), 286, C.dim)}${t('2025-10-03', col(21), 286, C.fg)}${t('\u00b7 last', col(32), 286, C.dim)}${t('4d ago', col(39), 286, C.fg)}

    ${t('maintainers', col(0), 308, C.dim)}${t('you, release-bot', col(12), 308, C.fg)}
    ${hr(328, W)}
    ${keyRow(
      [
        ['/', 'filter'],
        ['Enter', 'actions'],
        ['v', 'versions'],
        ['o', 'open'],
        ['r', 'refresh'],
        ['s', 'sort'],
      ],
      350,
    )}
    ${keyRow(
      [
        ['?', 'help'],
        ['q', 'quit'],
      ],
      372,
    )}
  </g>
</svg>
`,
    )
  }
}

const [, , flag, dir] = process.argv
if (flag === '--all') {
  for (const [name, theme] of Object.entries(THEMES)) build(theme, join(dir, name))
  console.log(`wrote ${Object.keys(THEMES).length} themes to ${dir}`)
} else {
  build(THEMES[ACTIVE], new URL('.', import.meta.url).pathname)
  console.log(`wrote banner.svg, demo-run.svg, demo-mine.svg (theme: ${ACTIVE})`)
}
