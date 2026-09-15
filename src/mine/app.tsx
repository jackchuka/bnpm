import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Box, Text, useInput } from 'ink'
import {
  availableActions,
  buildArgv,
  managerFor,
  supportsDryRun,
  type ActionItem,
  type ActionKind,
  type ActionRequest,
} from './actions.ts'
import { commandLine, type PackageManager } from '../pm.ts'
import { theme } from '../ui/colors.ts'
import { flow, type Choice, type Step } from './flows.ts'
import { formatCount, sparkline, timeAgo } from './format.ts'
import { filterRows, sortRows, SORT_KEYS, type MineRow, type SortKey } from './rows.ts'
import type { MineStore } from './store.ts'
import { validateCustom } from './validate.ts'

export interface UiState {
  sort: SortKey
  query: string
  cursor: string | undefined
  message?: { text: string; ok: boolean } | undefined
}

export const initialUiState = (): UiState => ({ sort: 'name', query: '', cursor: undefined })

export type AppResult =
  | { kind: 'quit' }
  | { kind: 'run'; pm: PackageManager; argv: string[]; pkg: string; state: UiState; wait: boolean }
  /** Step aside and hand off to the manager's own `login`, then reload. */
  | { kind: 'login'; state: UiState }

export interface AppProps {
  store: MineStore
  state: UiState
  onExit: (result: AppResult) => void
  openUrl?: (url: string) => void
  pm?: PackageManager
  npmAvailable?: boolean
  npmjs?: boolean
  columns?: number
  rows?: number
}

type Overlay =
  | { type: 'menu'; pkg: string; version?: string | undefined; index: number }
  | {
      type: 'step'
      pkg: string
      kind: ActionKind
      gen: Generator<
        Step,
        ReturnType<typeof flow> extends Generator<Step, infer R, string> ? R : never,
        string
      >
      step: Step
      index: number
      input: string
      crumbs: string[]
      error?: string | undefined
    }
  | { type: 'confirm'; pkg: string; req: ActionRequest; crumbs: string[] }
  | { type: 'versions'; pkg: string; index: number; input: string }
  | { type: 'help' }

const LABELS: Record<ActionKind, string> = {
  deprecate: 'Deprecate',
  undeprecate: 'Undeprecate',
  'dist-tag': 'Dist-tag',
  'dist-tag-add': 'Dist-tag add',
  'dist-tag-rm': 'Dist-tag rm',
  'dist-tag-ls': 'Dist-tag ls',
  owner: 'Owners',
  'owner-add': 'Owner add',
  'owner-rm': 'Owner rm',
  access: 'Access',
  unpublish: 'Unpublish',
  view: 'View',
  open: 'Open',
}

const fuzzy = (q: string, text: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const t = text.toLowerCase()
  if (t.includes(s)) return true
  let i = 0
  for (const ch of t) if (ch === s[i]) i++
  return i === s.length
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, Math.max(0, max - 1)))

type PickChoice = Choice & { custom?: boolean }

export function App({
  store,
  state,
  onExit,
  openUrl,
  pm = 'npm',
  npmAvailable = true,
  npmjs = true,
  columns = 100,
  rows = 30,
}: AppProps) {
  const runWith = (req: ActionRequest, argv: string[], pkg: string, wait: boolean): AppResult => ({
    kind: 'run',
    pm: managerFor(req.kind, pm, npmAvailable),
    argv,
    pkg,
    state: uiState(),
    wait,
  })
  useSyncExternalStore(store.subscribe, () => store.version)
  const all = store.rows
  const [sort, setSort] = useState<SortKey>(state.sort)
  const [query, setQuery] = useState(state.query)
  const [filtering, setFiltering] = useState(false)
  const [cursorName, setCursorName] = useState<string | undefined>(state.cursor)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [message, setMessage] = useState(state.message)

  const visible = useMemo(() => sortRows(filterRows(all, query), sort), [all, query, sort])
  const cursorIdx = Math.max(
    0,
    visible.findIndex((r) => r.name === cursorName),
  )
  const current = visible[cursorIdx]
  const uiState = (): UiState => ({ sort, query, cursor: current?.name, message: undefined })

  useEffect(() => {
    if (current && !current.range && current.status === 'loaded') void store.loadRange(current.name)
  }, [current, store])

  const move = (delta: number) => {
    if (visible.length === 0) return
    const next = clamp(cursorIdx + delta, visible.length)
    setCursorName(visible[next]?.name)
  }

  const openMenu = (pkg: string, version?: string) =>
    setOverlay({ type: 'menu', pkg, version, index: 0 })

  const startFlow = (pkg: string, kind: ActionKind, version?: string) => {
    const row = all.find((r) => r.name === pkg)
    if (!row) return
    if (kind === 'open') {
      openUrl?.(`https://www.npmjs.com/package/${pkg}`)
      setMessage({ text: `opened ${pkg} on npmjs.com`, ok: true })
      setOverlay(null)
      return
    }
    if (kind === 'view') {
      const req: ActionRequest = { kind: 'view', pkg }
      onExit(runWith(req, buildArgv(req), pkg, true))
      return
    }
    if (kind === 'access' && row.visibility === undefined) {
      // Fetch the current status first so the picker can show it, then re-enter with the fresh row.
      void store.loadVisibility(pkg).then(() => {
        const fresh = store.rows.find((r) => r.name === pkg) ?? row
        beginFlow({ ...fresh, visibility: fresh.visibility ?? 'public' }, kind, version)
      })
      return
    }
    beginFlow(row, kind, version)
  }

  const beginFlow = (row: MineRow, kind: ActionKind, version?: string) => {
    const pkg = row.name
    const gen = flow(kind, row, store.user ?? '', version ? { version } : {})
    const crumbs = [pkg, LABELS[kind], ...(version ? [version] : [])]
    advance(
      {
        type: 'step',
        pkg,
        kind,
        gen,
        step: { type: 'text', title: '' },
        index: 0,
        input: '',
        crumbs,
      },
      undefined,
    )
  }

  const advance = (o: Extract<Overlay, { type: 'step' }>, answer: string | undefined) => {
    const next = answer === undefined ? o.gen.next() : o.gen.next(answer)
    if (!next.done) {
      setOverlay({
        ...o,
        step: next.value,
        index: 0,
        input: '',
        crumbs: answer ? [...o.crumbs, answer] : o.crumbs,
      })
      return
    }
    const result = next.value
    if (!result) {
      setMessage({ text: 'cancelled', ok: false })
      openMenu(o.pkg)
      return
    }
    if (result.kind === 'open') {
      startFlow(o.pkg, 'open')
      return
    }
    setOverlay({
      type: 'confirm',
      pkg: o.pkg,
      req: result,
      crumbs: [...o.crumbs, ...(answer ? [answer] : [])],
    })
  }

  const menuItems = (o: Extract<Overlay, { type: 'menu' }>): ActionItem[] => {
    const row = all.find((r) => r.name === o.pkg)
    const items = availableActions({
      deprecatedCount: row?.deprecatedCount ?? 0,
      access: row?.access ?? 'read',
      pm,
      npmAvailable,
      npmjs,
    })
    if (!o.version) return items
    const v = row?.summary?.versions.find((x) => x.version === o.version)
    return items.filter((i) =>
      i.kind === 'undeprecate'
        ? v?.deprecated !== undefined
        : i.kind === 'deprecate'
          ? v?.deprecated === undefined
          : ['dist-tag', 'unpublish'].includes(i.kind),
    )
  }

  const pickChoices = (step: Extract<Step, { type: 'pick' }>, input: string): PickChoice[] => {
    const matched = step.choices.filter((c) => fuzzy(input, `${c.label} ${c.hint ?? ''}`))
    const typed = input.trim()
    const exact = step.choices.some((c) => c.value === typed || c.label === typed)
    if (!step.allowCustom || !typed || exact) return matched
    // After matches so Enter prefers an existing choice; first only when nothing matches.
    return [
      ...matched,
      { value: typed, label: `use "${typed}"`, hint: step.allowCustom, custom: true },
    ]
  }

  useInput((input, key) => {
    if (key.ctrl && input === 'c') return onExit({ kind: 'quit' })

    if (overlay?.type === 'help') {
      setOverlay(null)
      return
    }

    if (overlay?.type === 'menu') {
      const items = menuItems(overlay)
      if (key.escape) return setOverlay(null)
      if (key.upArrow || input === 'k')
        return setOverlay({ ...overlay, index: clamp(overlay.index - 1, items.length) })
      if (key.downArrow || input === 'j')
        return setOverlay({ ...overlay, index: clamp(overlay.index + 1, items.length) })
      if (key.return) {
        const item = items[overlay.index]
        if (item) startFlow(overlay.pkg, item.kind, overlay.version)
      }
      return
    }

    if (overlay?.type === 'step') {
      if (key.escape) return openMenu(overlay.pkg)
      const { step } = overlay
      if (step.type === 'pick') {
        const choices = pickChoices(step, overlay.input)
        if (key.upArrow)
          return setOverlay({ ...overlay, index: clamp(overlay.index - 1, choices.length) })
        if (key.downArrow)
          return setOverlay({ ...overlay, index: clamp(overlay.index + 1, choices.length) })
        if (key.return) {
          const c = choices[overlay.index]
          if (!c) return
          const error =
            c.custom && step.allowCustom ? validateCustom(step.allowCustom, c.value) : undefined
          if (error) return setOverlay({ ...overlay, error })
          advance(overlay, c.value)
          return
        }
        if (key.backspace || key.delete)
          return setOverlay({
            ...overlay,
            input: overlay.input.slice(0, -1),
            index: 0,
            error: undefined,
          })
        if (input && !key.ctrl && !key.meta)
          return setOverlay({
            ...overlay,
            input: overlay.input + input,
            index: 0,
            error: undefined,
          })
        return
      }
      if (key.return) {
        const value = overlay.input
        if (step.type === 'text' && step.required && !value.trim()) return
        if (step.type === 'typed' && value !== step.expected) return
        return advance(overlay, value)
      }
      if (key.backspace || key.delete)
        return setOverlay({ ...overlay, input: overlay.input.slice(0, -1) })
      if (input && !key.ctrl && !key.meta)
        return setOverlay({ ...overlay, input: overlay.input + input })
      return
    }

    if (overlay?.type === 'confirm') {
      if (key.escape) return openMenu(overlay.pkg)
      if (key.return)
        return onExit(runWith(overlay.req, buildArgv(overlay.req), overlay.pkg, false))
      if (input === 'd') {
        const argv = buildArgv(overlay.req, {
          dryRun: true,
          pm: managerFor(overlay.req.kind, pm, npmAvailable),
        })
        if (argv.includes('--dry-run')) onExit(runWith(overlay.req, argv, overlay.pkg, true))
      }
      return
    }

    if (overlay?.type === 'versions') {
      const row = all.find((r) => r.name === overlay.pkg)
      const versions = (row?.summary?.versions ?? []).filter((v) => fuzzy(overlay.input, v.version))
      if (key.escape) return setOverlay(null)
      if (key.upArrow)
        return setOverlay({ ...overlay, index: clamp(overlay.index - 1, versions.length) })
      if (key.downArrow)
        return setOverlay({ ...overlay, index: clamp(overlay.index + 1, versions.length) })
      if (key.return) {
        const v = versions[overlay.index]
        if (v) openMenu(overlay.pkg, v.version)
        return
      }
      if (key.backspace || key.delete)
        return setOverlay({ ...overlay, input: overlay.input.slice(0, -1), index: 0 })
      if (input && !key.ctrl && !key.meta)
        return setOverlay({ ...overlay, input: overlay.input + input, index: 0 })
      return
    }

    if (filtering) {
      if (key.escape) {
        setQuery('')
        setFiltering(false)
        return
      }
      if (key.return) return setFiltering(false)
      if (key.upArrow) return move(-1)
      if (key.downArrow) return move(1)
      if (key.backspace || key.delete) return setQuery((q) => q.slice(0, -1))
      if (input && !key.ctrl && !key.meta) setQuery((q) => q + input)
      return
    }

    if (key.upArrow || input === 'k') return move(-1)
    if (key.downArrow || input === 'j') return move(1)
    if (input === 'g') return setCursorName(visible[0]?.name)
    if (input === 'G') return setCursorName(visible.at(-1)?.name)
    if (input === '/') return setFiltering(true)
    if (input === 's')
      return setSort(SORT_KEYS[(SORT_KEYS.indexOf(sort) + 1) % SORT_KEYS.length] ?? 'name')
    if (input === '?') return setOverlay({ type: 'help' })
    if (input === 'q') return onExit({ kind: 'quit' })
    if (key.escape) {
      if (query) return setQuery('')
      return onExit({ kind: 'quit' })
    }
    if (input === 'l' && store.authFailed) return onExit({ kind: 'login', state: uiState() })
    if ((input === 'r' || input === 'R') && store.loadError) {
      void store.load().catch(() => {})
      return
    }
    if (!current) return
    if (key.return) return openMenu(current.name)
    if (input === 'v')
      return setOverlay({ type: 'versions', pkg: current.name, index: 0, input: '' })
    if (input === 'o' && npmjs) return startFlow(current.name, 'open')
    if (input === 'r') {
      void store.refresh(current.name)
      if (store.downloadsError) void store.retryDownloads()
      return
    }
    if (input === 'R') {
      void store.retryDownloads()
      return
    }
  })

  const loading = all.filter((r) => r.status === 'loading').length
  const placeholder =
    all.length > 0
      ? 'no match'
      : store.loadError
        ? store.authFailed
          ? 'not logged in — press l to log in'
          : 'unable to load packages'
        : loading || !store.user
          ? 'loading…'
          : 'no packages'
  const status = message
    ? `${message.ok ? '✓' : '✗'} ${message.text}`
    : store.loadError
      ? `✗ ${store.loadError}${store.authFailed ? ' · l to log in' : ''} · r to retry`
      : store.downloadsError
        ? `✗ downloads unavailable: ${store.downloadsError} · R to retry`
        : ' '
  const width = columns
  // Ink can only erase lines still on screen, so the frame must stay shorter than the terminal.
  const fixedLines = 8 + (overlay ? 11 : 5)
  const tableHeight = Math.max(3, rows - fixedLines - 1)
  const start = Math.max(
    0,
    Math.min(cursorIdx - Math.floor(tableHeight / 2), visible.length - tableHeight),
  )
  const window = visible.slice(start, start + tableHeight)

  const nameWidth = Math.max(
    12,
    Math.min(Math.max(...visible.map((r) => r.name.length), 7), width - 54),
  )

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between">
        <Text>
          <Text bold color={theme.accent}>
            bnpm mine
          </Text>
          <Text dimColor>
            {' '}
            · {store.user ?? '…'} · {all.length} packages · sort: {sort}
          </Text>
          {filtering || query ? (
            <Text color={theme.accent}>
              {'  /'}
              {query}
              {filtering ? '█' : ''}
            </Text>
          ) : null}
        </Text>
        {loading > 0 ? <Text color={theme.yellow}>⟳ {loading} loading</Text> : null}
      </Box>
      <Text dimColor>{'─'.repeat(width)}</Text>
      <Row
        cells={['  Package', 'Latest', 'Tags', 'Published', '↓/wk', '']}
        nameWidth={nameWidth}
        header
      />
      {window.map((r) => (
        <TableRow key={r.name} row={r} selected={r === current} nameWidth={nameWidth} />
      ))}
      {visible.length === 0 ? <Text dimColor> {placeholder}</Text> : null}
      <Text dimColor>{'─'.repeat(width)}</Text>
      {overlay ? (
        <OverlayView
          overlay={overlay}
          all={all}
          menuItems={menuItems}
          pickChoices={pickChoices}
          pmFor={(kind) => managerFor(kind, pm, npmAvailable)}
          npmjs={npmjs}
        />
      ) : (
        <Detail row={current} />
      )}
      <Text dimColor>{'─'.repeat(width)}</Text>
      <Keys
        pairs={
          overlay
            ? overlay.type === 'confirm'
              ? runKeys(
                  supportsDryRun(overlay.req.kind, managerFor(overlay.req.kind, pm, npmAvailable)),
                )
              : PICKER_KEYS
            : MAIN_KEYS
        }
      />
      <Text color={message?.ok ? theme.green : theme.error}>{status}</Text>
    </Box>
  )
}

/** Key hints: the key in accent, its label dim. A pair with no key is plain guidance. */
function Keys({ pairs }: { pairs: [string, string][] }) {
  return (
    <Text>
      {pairs.map(([key, label], i) => (
        <React.Fragment key={label}>
          {i > 0 ? <Text dimColor>{'   '}</Text> : null}
          {key ? (
            <Text bold color={theme.accent}>
              {key}
            </Text>
          ) : null}
          <Text dimColor>{key ? ` ${label}` : label}</Text>
        </React.Fragment>
      ))}
    </Text>
  )
}

const MAIN_KEYS: [string, string][] = [
  ['/', 'filter'],
  ['Enter', 'actions'],
  ['v', 'versions'],
  ['o', 'open'],
  ['r', 'refresh'],
  ['s', 'sort'],
  ['?', 'help'],
  ['q', 'quit'],
]
const PICKER_KEYS: [string, string][] = [
  ['↑/↓', 'move'],
  ['Enter', 'select'],
  ['Esc', 'back'],
  ['', 'type to filter'],
]
const runKeys = (dryRun: boolean): [string, string][] =>
  dryRun
    ? [
        ['Enter', 'run'],
        ['d', 'dry-run'],
        ['Esc', 'back'],
      ]
    : [
        ['Enter', 'run'],
        ['Esc', 'back'],
      ]

function Row({
  cells,
  nameWidth,
  header,
}: {
  cells: string[]
  nameWidth: number
  header?: boolean
}) {
  const widths = [nameWidth + 3, 16, 5, 11, 7, 12]
  return (
    <Box>
      {cells.map((c, i) => (
        <Box key={i} width={widths[i]} flexShrink={0}>
          <Text {...(header ? { dimColor: true } : {})} wrap="truncate">
            {c}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function TableRow({
  row,
  selected,
  nameWidth,
}: {
  row: MineRow
  selected: boolean
  nameWidth: number
}) {
  const widths = [nameWidth + 3, 16, 5, 11, 7, 12]
  const flag =
    row.status === 'error'
      ? 'error'
      : row.latestDeprecated
        ? 'deprecated'
        : row.status === 'loading'
          ? 'loading'
          : ''
  const cells = [
    row.name,
    row.latest ?? (row.status === 'loading' ? '…' : ''),
    row.tagCount !== undefined ? String(row.tagCount) : '',
    row.status === 'loaded' ? timeAgo(row.lastPublished) : '',
    formatCount(row.weekly),
    flag,
  ]
  return (
    <Box>
      {cells.map((c, i) => (
        <Box key={i} width={widths[i]} flexShrink={0}>
          <Text
            bold={selected}
            {...(i === 5 && flag === 'error' ? { color: theme.error } : {})}
            {...(i === 5 && flag === 'deprecated' ? { color: theme.yellow } : {})}
            dimColor={i === 5 && flag === 'loading'}
            wrap="truncate"
          >
            {i === 0 ? (
              <>
                <Text color={theme.accent}>{selected ? '▸ ' : '  '}</Text>
                {c}
              </>
            ) : (
              c
            )}
          </Text>
        </Box>
      ))}
    </Box>
  )
}

function Detail({ row }: { row: MineRow | undefined }) {
  if (!row) return <Text dimColor> </Text>
  const s = row.summary
  if (row.status === 'error') {
    return (
      <Box flexDirection="column">
        <Text bold>{row.name}</Text>
        <Text color={theme.error}>{row.error}</Text>
      </Box>
    )
  }
  const tags = s
    ? Object.entries(s.distTags)
        .map(([t, v]) => `${t} ${v}`)
        .join(' · ')
    : ''
  const month = row.range?.reduce((a, b) => a + b, 0)
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold>{row.name}</Text>
        <Text dimColor>
          {[row.access === 'write' ? 'read-write' : 'read-only', row.visibility]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
      <Text dimColor>{tags || (row.status === 'loading' ? 'loading…' : '')}</Text>
      <Text>
        <Text dimColor>downloads </Text>
        {formatCount(row.weekly)}/wk{month !== undefined ? ` · ${formatCount(month)}/mo` : ''}
        {'  '}
        <Text color={theme.accent}>{row.range ? sparkline(row.range) : ''}</Text>
      </Text>
      <Text dimColor>
        {s
          ? `versions ${s.versions.length} · first ${s.created?.slice(0, 10) ?? '—'} · last ${timeAgo(s.lastPublished)}${s.deprecatedCount ? ` · ${s.deprecatedCount} deprecated` : ''}`
          : ''}
      </Text>
      <Text dimColor>{s ? `maintainers ${s.maintainers.join(', ')}` : ''}</Text>
    </Box>
  )
}

function OverlayView({
  overlay,
  all,
  menuItems,
  pickChoices,
  pmFor,
  npmjs,
}: {
  overlay: Overlay
  all: MineRow[]
  npmjs: boolean
  menuItems: (o: Extract<Overlay, { type: 'menu' }>) => ActionItem[]
  pickChoices: (s: Extract<Step, { type: 'pick' }>, input: string) => PickChoice[]
  pmFor: (kind: ActionRequest['kind']) => PackageManager
}) {
  switch (overlay.type) {
    case 'help':
      return (
        <Box flexDirection="column">
          <Text bold>Keys</Text>
          <Text>
            j/k ↑/↓ move · g/G top/bottom · / filter · s cycle sort (name → published → downloads →
            deprecated)
          </Text>
          <Text>
            Enter actions for package · v version list ·{npmjs ? ' o open on npmjs.com ·' : ''} r
            refresh row · R retry downloads · q quit
          </Text>
          <Text dimColor>
            Writes always show the exact command and binary first. d runs it with --dry-run where
            npm supports it (deprecate, undeprecate, unpublish).
          </Text>
          <Text dimColor>press any key to close</Text>
        </Box>
      )
    case 'menu': {
      const items = menuItems(overlay)
      return (
        <Box flexDirection="column">
          <Crumbs parts={[overlay.pkg, ...(overlay.version ? [overlay.version] : [])]} />
          {items.map((it, i) => (
            <Text
              key={it.kind}
              {...(it.destructive ? { color: theme.error } : {})}
              bold={i === overlay.index}
              inverse={i === overlay.index}
            >
              {i === overlay.index ? '▸ ' : '  '}
              {it.label}
            </Text>
          ))}
        </Box>
      )
    }
    case 'step': {
      const { step } = overlay
      if (step.type === 'pick') {
        const choices = pickChoices(step, overlay.input)
        const start = Math.max(0, Math.min(overlay.index - 3, choices.length - 8))
        return (
          <Box flexDirection="column">
            <Crumbs parts={[...overlay.crumbs, step.title]} />
            <Text dimColor>
              {step.allowCustom ? 'filter or type a value: ' : 'filter: '}
              <Text color={theme.accent}>{overlay.input}█</Text>
              {choices.length !== step.choices.length
                ? ` (${choices.length} of ${step.choices.length})`
                : ''}
            </Text>
            {overlay.error ? <Text color={theme.error}>{overlay.error}</Text> : null}
            {choices.slice(start, start + 8).map((c, j) => {
              const i = start + j
              return (
                <Text
                  key={c.value}
                  bold={i === overlay.index}
                  inverse={i === overlay.index}
                  {...(c.danger ? { color: theme.error } : {})}
                  {...(c.custom ? { color: 'cyan' } : {})}
                >
                  {i === overlay.index ? '▸ ' : '  '}
                  {c.label}
                  {c.hint ? (
                    <Text dimColor>
                      {'  '}
                      {c.hint}
                    </Text>
                  ) : null}
                </Text>
              )
            })}
            {choices.length === 0 ? (
              <Text dimColor> {step.allowCustom ? 'type a value' : 'nothing matches'}</Text>
            ) : null}
          </Box>
        )
      }
      const invalid =
        step.type === 'typed'
          ? overlay.input !== step.expected
          : Boolean(step.required && !overlay.input.trim())
      return (
        <Box flexDirection="column">
          <Crumbs parts={[...overlay.crumbs, step.title]} />
          <Text>
            {'> '}
            <Text color={theme.accent}>{overlay.input}</Text>█
            {!overlay.input && step.type === 'text' && step.placeholder ? (
              <Text dimColor>{step.placeholder}</Text>
            ) : null}
          </Text>
          <Text dimColor>
            {invalid
              ? step.type === 'typed'
                ? `must match ${step.expected} exactly`
                : 'required'
              : 'Enter to continue'}
          </Text>
        </Box>
      )
    }
    case 'confirm': {
      const argv = buildArgv(overlay.req)
      const destructive = overlay.req.kind === 'unpublish'
      return (
        <Box flexDirection="column">
          <Crumbs parts={[...overlay.crumbs, 'confirm']} />
          <Text>
            <Text dimColor>$ </Text>
            <Text bold {...(destructive ? { color: theme.error } : {})}>
              {commandLine(argv, pmFor(overlay.req.kind))}
            </Text>
          </Text>
          {destructive ? (
            <Text color={theme.error}>
              This cannot be undone. npm only allows unpublish within 72h or for unused packages.
            </Text>
          ) : null}
          <Keys pairs={runKeys(supportsDryRun(overlay.req.kind, pmFor(overlay.req.kind)))} />
        </Box>
      )
    }
    case 'versions': {
      const row = all.find((r) => r.name === overlay.pkg)
      const versions = (row?.summary?.versions ?? []).filter((v) => fuzzy(overlay.input, v.version))
      const start = Math.max(0, Math.min(overlay.index - 3, versions.length - 8))
      return (
        <Box flexDirection="column">
          <Crumbs parts={[overlay.pkg, 'versions']} />
          <Text dimColor>
            filter: <Text color={theme.accent}>{overlay.input}█</Text> ({versions.length})
          </Text>
          {versions.slice(start, start + 8).map((v, j) => {
            const i = start + j
            return (
              <Text key={v.version} bold={i === overlay.index} inverse={i === overlay.index}>
                {i === overlay.index ? '▸ ' : '  '}
                {v.version.padEnd(16)}
                <Text color={theme.accent}>{v.tags.join(',').padEnd(10)}</Text>
                <Text dimColor>{timeAgo(v.time).padEnd(10)}</Text>
                {v.deprecated !== undefined ? <Text color={theme.yellow}>deprecated</Text> : null}
              </Text>
            )
          })}
        </Box>
      )
    }
  }
}

function Crumbs({ parts }: { parts: string[] }) {
  return (
    <Text>
      {parts.map((p, i) => (
        <Text key={i}>
          {i > 0 ? <Text dimColor> › </Text> : null}
          <Text bold={i === parts.length - 1}>{p}</Text>
        </Text>
      ))}
    </Text>
  )
}
