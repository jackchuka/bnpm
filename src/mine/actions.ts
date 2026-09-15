import type { PackageManager } from '../pm.ts'

export type ActionRequest =
  | { kind: 'deprecate'; pkg: string; version: string; message: string }
  | { kind: 'undeprecate'; pkg: string; version: string }
  | { kind: 'dist-tag-add'; pkg: string; version: string; tag: string }
  | { kind: 'dist-tag-rm'; pkg: string; tag: string }
  | { kind: 'dist-tag-ls'; pkg: string }
  | { kind: 'owner-add'; pkg: string; user: string }
  | { kind: 'owner-rm'; pkg: string; user: string }
  | { kind: 'access'; pkg: string; status: 'public' | 'private' }
  | { kind: 'unpublish'; pkg: string; version: string }
  | { kind: 'view'; pkg: string }

export type ActionKind = ActionRequest['kind'] | 'dist-tag' | 'owner' | 'open'

export interface ActionItem {
  kind: ActionKind
  label: string
  destructive?: boolean
}

const spec = (pkg: string, version: string) => (version === '*' ? pkg : `${pkg}@${version}`)

// npm supports --dry-run on exactly these three; `npm owner` does not, and pnpm has it on none.
const DRY_RUN_OK = new Set<ActionRequest['kind']>(['deprecate', 'undeprecate', 'unpublish'])

export function supportsDryRun(kind: ActionRequest['kind'], pm: PackageManager = 'npm'): boolean {
  return pm === 'npm' && DRY_RUN_OK.has(kind)
}

export function buildArgv(
  req: ActionRequest,
  opts: { dryRun?: boolean; pm?: PackageManager } = {},
): string[] {
  let argv: string[]
  switch (req.kind) {
    case 'deprecate':
      argv = ['deprecate', spec(req.pkg, req.version), req.message]
      break
    case 'undeprecate':
      argv = ['undeprecate', spec(req.pkg, req.version)]
      break
    case 'dist-tag-add':
      argv = ['dist-tag', 'add', `${req.pkg}@${req.version}`, req.tag]
      break
    case 'dist-tag-rm':
      argv = ['dist-tag', 'rm', req.pkg, req.tag]
      break
    case 'dist-tag-ls':
      argv = ['dist-tag', 'ls', req.pkg]
      break
    case 'owner-add':
      argv = ['owner', 'add', req.user, req.pkg]
      break
    case 'owner-rm':
      argv = ['owner', 'rm', req.user, req.pkg]
      break
    case 'access':
      argv = ['access', 'set', `status=${req.status}`, req.pkg]
      break
    case 'unpublish':
      argv =
        req.version === '*'
          ? ['unpublish', req.pkg, '--force']
          : ['unpublish', spec(req.pkg, req.version)]
      break
    case 'view':
      argv = ['view', req.pkg]
      break
  }
  if (opts.dryRun && supportsDryRun(req.kind, opts.pm)) argv.push('--dry-run')
  return argv
}

// Verified 2026-09 against registry.npmjs.org: pnpm 11.27 and 12.4 return "package not found" from
// `owner ls` for every package and "405 Method Not Allowed" from `access get status`, while
// deprecate, dist-tag, unpublish, and view work. So owner/access prefer npm when it is installed.
const PNPM_UNRELIABLE = new Set<ActionRequest['kind']>(['owner-add', 'owner-rm', 'access'])

export function managerFor(
  kind: ActionRequest['kind'],
  pm: PackageManager,
  npmAvailable: boolean,
): PackageManager {
  if (pm === 'npm' || !PNPM_UNRELIABLE.has(kind)) return pm
  return npmAvailable ? 'npm' : pm
}

export function availableActions(ctx: {
  deprecatedCount: number
  access: 'read' | 'write'
  pm?: PackageManager
  npmAvailable?: boolean
  npmjs?: boolean
}): ActionItem[] {
  const ownerAccessOk = (ctx.pm ?? 'npm') === 'npm' || (ctx.npmAvailable ?? true)
  // Other registries have no fixed package-page URL, so the browser action only exists on npmjs.
  const open: ActionItem[] =
    (ctx.npmjs ?? true) ? [{ kind: 'open', label: 'Open on npmjs.com' }] : []
  if (ctx.access === 'read') return [{ kind: 'view', label: 'View' }, ...open]
  const items: ActionItem[] = [{ kind: 'deprecate', label: 'Deprecate…' }]
  if (ctx.deprecatedCount > 0) items.push({ kind: 'undeprecate', label: 'Undeprecate…' })
  items.push({ kind: 'dist-tag', label: 'Dist-tag…' })
  if (ownerAccessOk)
    items.push({ kind: 'owner', label: 'Owners…' }, { kind: 'access', label: 'Access…' })
  items.push({ kind: 'view', label: 'View' }, ...open, {
    kind: 'unpublish',
    label: 'Unpublish…',
    destructive: true,
  })
  return items
}
