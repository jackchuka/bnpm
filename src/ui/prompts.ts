import { AutocompletePrompt, TextPrompt, isCancel } from '@clack/core'
import type { State } from '@clack/core'
import { accent, barEnd, bold, dim, good, header, line, S, warn } from './chrome.ts'
import { commandLine } from '../pm.ts'
import { validateCustom, type CustomKind } from '../mine/validate.ts'

export const CANCELLED = 130

const ESC = '\u001B'
const HIDE_CURSOR = `${ESC}[?25l`
const SHOW_CURSOR = `${ESC}[?25h`
const CLEAR_LINE = `\r${ESC}[2K`

const out = (s: string) => process.stdout.write(s)

export function cancelled(): never {
  out(`${dim(S.barEnd)}  ${dim('Cancelled')}\n`)
  process.exit(CANCELLED)
}

export function guard<T>(value: T | symbol): T {
  if (isCancel(value)) cancelled()
  return value as T
}

export interface Choice<V> {
  value: V
  label: string
  hint?: string | undefined
}

type Opt<V> = { value: V; label: string; hint?: string | undefined }

const toOptions = <V>(choices: Choice<V>[]): Opt<V>[] =>
  choices.map((c) => ({ value: c.value, label: c.label, hint: c.hint }))

export const matches = (search: string, label: string): boolean => {
  const s = search.trim().toLowerCase()
  if (!s) return true
  const t = label.toLowerCase()
  if (t.includes(s)) return true
  let i = 0
  for (const ch of t) if (ch === s[i]) i++
  return i === s.length
}

/**
 * clack calls validate with the highlighted option's value, which is undefined when the list is
 * empty; without this an empty Enter would be accepted as "".
 */
export function pickValidation(kind: CustomKind, isCustom: (v: string) => boolean) {
  return (v: unknown): string | undefined => {
    if (typeof v !== 'string' || !v.trim()) return 'required'
    return isCustom(v) ? validateCustom(kind, v) : undefined
  }
}

const MAX_ITEMS = 12

/** The window of options around the cursor, so a long list scrolls rather than floods. */
function windowed<T>(items: T[], cursor: number, max: number): { rows: T[]; from: number } {
  if (items.length <= max) return { rows: items, from: 0 }
  const from = Math.max(0, Math.min(cursor - Math.floor(max / 2), items.length - max))
  return { rows: items.slice(from, from + max), from }
}

/**
 * The focused row carries the accent and full brightness; every other row is dimmed so the
 * cursor is obvious at a glance. Marking only the bullet left the rows too close to each other.
 */
function optionRow<V>(o: Opt<V>, focused: boolean, checked: boolean | undefined): string {
  const mark =
    checked === undefined
      ? focused
        ? accent(S.on)
        : dim(S.off)
      : checked
        ? accent(S.checked)
        : dim(S.unchecked)
  const label = focused ? bold(accent(o.label)) : dim(o.label)
  const hint = o.hint ? `  ${dim(o.hint)}` : ''
  return `${mark} ${label}${hint}`
}

const closing = (state: State, error: string): string[] =>
  state === 'error' ? [line(warn(error)), barEnd] : [barEnd]

function autocompleteFrame<V>(
  prompt: AutocompletePrompt<Opt<V>>,
  message: string,
  placeholder: string,
): string {
  const { state } = prompt
  const head = header(state, message)
  const labelOf = (v: V) => prompt.options.find((o) => o.value === v)?.label ?? String(v)

  if (state === 'submit') {
    const chosen = prompt.multiple
      ? (prompt.value as V[]).map(labelOf).join(', ')
      : labelOf(prompt.value as V)
    return `${head}\n${line(dim(chosen))}`
  }
  if (state === 'cancel') return head

  const typed = prompt.userInput.trim()
  const shown = prompt.filteredOptions
  const tally = typed
    ? ` ${dim(`(${shown.length} ${shown.length === 1 ? 'match' : 'matches'})`)}`
    : ` ${dim(placeholder)}`
  const search = `${dim('Search:')} ${prompt.userInputWithCursor}${tally}`

  const { rows, from } = windowed(shown, prompt.cursor, MAX_ITEMS)
  const body = rows.map((o, i) =>
    line(
      optionRow(
        o,
        from + i === prompt.cursor,
        prompt.multiple ? prompt.selectedValues.includes(o.value) : undefined,
      ),
    ),
  )
  const hidden = shown.length - rows.length
  if (hidden > 0) body.push(line(dim(`${S.more} ${hidden} more`)))
  if (shown.length === 0) body.push(line(dim('nothing matches')))

  return [head, line(search), ...body, ...closing(state, prompt.error)].join('\n')
}

function textFrame(prompt: TextPrompt, message: string, placeholder?: string): string {
  const { state } = prompt
  const head = header(state, message)
  if (state === 'submit') return `${head}\n${line(dim(prompt.value ?? ''))}`
  if (state === 'cancel') return head
  const empty = prompt.userInput.length === 0
  const body = `${prompt.userInputWithCursor}${empty && placeholder ? ` ${dim(placeholder)}` : ''}`
  return [head, line(body), ...closing(state, prompt.error)].join('\n')
}

const withHint = (message: string, hint?: string) => (hint ? `${message} ${dim(hint)}` : message)

export async function pick<V>(message: string, choices: Choice<V>[], hint?: string): Promise<V> {
  const title = withHint(message, hint)
  const prompt = new AutocompletePrompt<Opt<V>>({
    options: toOptions(choices),
    filter: (search, o) => matches(search, o.label ?? String(o.value)),
    render() {
      return autocompleteFrame(this as AutocompletePrompt<Opt<V>>, title, 'type to filter')
    },
  })
  return guard<V>((await prompt.prompt()) as V | symbol)
}

/** Autocomplete over existing choices where anything typed that matches nothing becomes a selectable value. */
export async function pickOrType(
  message: string,
  choices: Choice<string>[],
  kind: CustomKind,
  hint?: string,
): Promise<string> {
  const base = toOptions(choices)
  const isCustom = (v: string) => !base.some((o) => o.value === v)
  const title = withHint(message, hint)
  const prompt = new AutocompletePrompt<Opt<string>>({
    options(this: AutocompletePrompt<Opt<string>>) {
      const typed = this.userInput.trim()
      if (!typed || !isCustom(typed) || base.some((o) => o.label === typed)) return base
      // After existing choices so Enter prefers a match; clack keeps this order after filtering.
      return [...base, { value: typed, label: `use "${typed}"`, hint: kind }]
    },
    filter: (search, o) =>
      o.label?.startsWith('use "') || matches(search, o.label ?? String(o.value)),
    validate: pickValidation(kind, isCustom),
    render() {
      return autocompleteFrame(
        this as AutocompletePrompt<Opt<string>>,
        title,
        `type to filter, or enter a ${kind}`,
      )
    },
  })
  return guard<string>((await prompt.prompt()) as string | symbol)
}

export async function pickMany<V>(
  message: string,
  choices: Choice<V>[],
  hint?: string,
): Promise<V[]> {
  const title = withHint(message, hint)
  const prompt = new AutocompletePrompt<Opt<V>>({
    options: toOptions(choices),
    multiple: true,
    filter: (search, o) => matches(search, o.label ?? String(o.value)),
    validate: (v) => (Array.isArray(v) && v.length > 0 ? undefined : 'select at least one'),
    render() {
      return autocompleteFrame(
        this as AutocompletePrompt<Opt<V>>,
        title,
        'type to filter, space to toggle',
      )
    },
  })
  return guard<V[]>((await prompt.prompt()) as V[] | symbol)
}

async function text(opts: {
  message: string
  placeholder?: string
  validate?: (v: string | undefined) => string | undefined
}): Promise<string | symbol> {
  const prompt = new TextPrompt({
    ...(opts.validate ? { validate: opts.validate as never } : {}),
    render() {
      return textFrame(this as TextPrompt, opts.message, opts.placeholder)
    },
  })
  return (await prompt.prompt()) as string | symbol
}

export async function ask(
  message: string,
  opts: { placeholder?: string; required?: boolean } = {},
): Promise<string> {
  return guard<string>(
    await text({
      message,
      ...(opts.placeholder ? { placeholder: opts.placeholder } : {}),
      validate: (v) => (opts.required && !v?.trim() ? 'Required' : undefined),
    }),
  )
}

/** A spinner in the prompt chrome. Animates only on a TTY; elsewhere it prints once. */
function spinner() {
  let timer: ReturnType<typeof setInterval> | undefined
  let frame = 0
  let label = ''
  return {
    start(message = '') {
      label = message
      if (!process.stdout.isTTY) {
        out(`${accent(S.active)}  ${label}\n`)
        return
      }
      out(HIDE_CURSOR)
      timer = setInterval(() => {
        out(`${CLEAR_LINE}${accent(S.spin[frame++ % S.spin.length] ?? '')}  ${label}`)
      }, 90)
    },
    stop(message = label) {
      if (timer) {
        clearInterval(timer)
        timer = undefined
        out(`${CLEAR_LINE}${SHOW_CURSOR}`)
      }
      out(`${good(S.submit)}  ${message}\n`)
    },
  }
}

const log = {
  step: (message: string) => out(`${good(S.submit)}  ${message}\n`),
  info: (message: string) => out(`${accent(S.active)}  ${message}\n`),
}

export function showCommand(argv: string[]): void {
  log.step(dim('$ ') + bold(commandLine(argv)))
}

/** The slice of the old `@clack/prompts` surface the shims still call. */
export const p = { log, spinner, text, isCancel }
