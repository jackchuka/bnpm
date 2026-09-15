import type { ActionKind, ActionRequest } from './actions.ts'
import type { MineRow } from './rows.ts'
import { timeAgo } from './format.ts'
import type { CustomKind } from './validate.ts'

export interface Choice {
  value: string
  label: string
  hint?: string | undefined
  danger?: boolean
}

export type Step =
  | { type: 'pick'; title: string; choices: Choice[]; allowCustom?: CustomKind }
  | { type: 'text'; title: string; placeholder?: string; required?: boolean }
  | { type: 'typed'; title: string; expected: string }

export type FlowResult = ActionRequest | { kind: 'open'; pkg: string } | null

const versionChoices = (
  row: MineRow,
  opts: { onlyDeprecated?: boolean; allLabel: string },
): Choice[] => {
  const versions = row.summary?.versions ?? []
  const list = opts.onlyDeprecated ? versions.filter((v) => v.deprecated !== undefined) : versions
  return [
    { value: '*', label: '*', hint: opts.allLabel },
    ...list.map((v) => ({
      value: v.version,
      label: v.version,
      hint: [v.tags.join(','), timeAgo(v.time), v.deprecated !== undefined ? 'deprecated' : '']
        .filter(Boolean)
        .join(' · '),
    })),
  ]
}

export function* flow(
  kind: ActionKind,
  row: MineRow,
  user: string,
  preset: { version?: string } = {},
): Generator<Step, FlowResult, string> {
  const pkg = row.name
  const pickVersion = function* (
    opts: Parameters<typeof versionChoices>[1],
  ): Generator<Step, string, string> {
    if (preset.version) return preset.version
    return yield {
      type: 'pick',
      title: 'version',
      choices: versionChoices(row, opts),
      allowCustom: 'range',
    }
  }

  switch (kind) {
    case 'deprecate': {
      const version = yield* pickVersion({ allLabel: 'all versions' })
      const message = yield {
        type: 'text',
        title: 'message',
        placeholder: 'Why, and what to use instead',
        required: true,
      }
      return { kind: 'deprecate', pkg, version, message }
    }
    case 'undeprecate': {
      const version = yield* pickVersion({
        onlyDeprecated: true,
        allLabel: 'all deprecated versions',
      })
      return { kind: 'undeprecate', pkg, version }
    }
    case 'dist-tag': {
      const mode = yield {
        type: 'pick',
        title: 'dist-tag',
        choices: [
          { value: 'ls', label: 'ls', hint: 'list tags · npm default' },
          { value: 'add', label: 'add', hint: 'point a tag at a version' },
          { value: 'rm', label: 'rm', hint: 'remove a tag' },
        ],
      }
      if (mode === 'ls') return { kind: 'dist-tag-ls', pkg }
      const existing = Object.entries(row.summary?.distTags ?? {}).filter(([t]) => t !== 'latest')
      if (mode === 'add') {
        const version =
          preset.version ??
          (yield {
            type: 'pick',
            title: 'version',
            choices: versionChoices(row, { allLabel: '' }).filter((c) => c.value !== '*'),
          })
        const tag = yield {
          type: 'pick',
          title: 'tag',
          choices: existing.map(([t, v]) => ({ value: t, label: t, hint: `currently ${v}` })),
          allowCustom: 'tag',
        }
        return { kind: 'dist-tag-add', pkg, version, tag }
      }
      const tag = yield {
        type: 'pick',
        title: 'tag',
        choices: existing.map(([t, v]) => ({ value: t, label: t, hint: v })),
      }
      return { kind: 'dist-tag-rm', pkg, tag }
    }
    case 'owner': {
      const owners = row.summary?.maintainers ?? []
      const others = owners.filter((m) => m !== user)
      const mode = yield {
        type: 'pick',
        title: owners.length ? `owners (currently ${owners.join(', ')})` : 'owners',
        choices: [
          { value: 'add', label: 'add', hint: 'grant publish rights to a user' },
          // Removing yourself would lock you out, so rm only appears when someone else is listed.
          ...(others.length ? [{ value: 'rm', label: 'rm', hint: 'remove a maintainer' }] : []),
        ],
      }
      if (mode === 'add') {
        const u = yield { type: 'pick', title: 'username', choices: [], allowCustom: 'user' }
        return { kind: 'owner-add', pkg, user: u }
      }
      const u = yield {
        type: 'pick',
        title: 'maintainer',
        choices: others.map((m) => ({ value: m, label: m })),
      }
      return { kind: 'owner-rm', pkg, user: u }
    }
    case 'access': {
      const current = row.visibility
      const options: Choice[] = [
        { value: 'public', label: 'public' },
        { value: 'private', label: 'private', hint: 'requires a paid org/scope' },
      ]
      // Put the other status first so Enter changes something; mark the current one.
      const choices = options
        .map((c) => (c.value === current ? { ...c, hint: 'current' } : c))
        .toSorted((a, b) => Number(a.value === current) - Number(b.value === current))
      const status = yield {
        type: 'pick',
        title: current ? `access (currently ${current})` : 'access',
        choices,
      }
      if (status === current) return null
      return { kind: 'access', pkg, status: status as 'public' | 'private' }
    }
    case 'unpublish': {
      const version = yield* pickVersion({ allLabel: 'ENTIRE PACKAGE' })
      const typed = yield { type: 'typed', title: `type ${pkg} to confirm`, expected: pkg }
      if (typed !== pkg) return null
      return { kind: 'unpublish', pkg, version }
    }
    case 'view':
      return { kind: 'view', pkg }
    case 'open':
      return { kind: 'open', pkg }
    default:
      return null
  }
}
