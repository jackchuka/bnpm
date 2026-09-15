import type { Dependency } from '../pkgjson.ts'
import type { PackageAccess } from '../registry/client.ts'
import type { Choice } from '../ui/prompts.ts'

const CURRENT_HINT = 'current package · npm default'

/**
 * Order: the current package (npm's own no-argument target), then the project's dependencies
 * (the usual reason to run `view`), then everything the account can publish.
 */
export function packageChoices(
  pkgs: PackageAccess,
  current: string | undefined,
  deps: Dependency[] = [],
): Choice<string>[] {
  const seen = new Set<string>()
  const out: Choice<string>[] = []
  const add = (c: Choice<string>) => {
    if (seen.has(c.value)) return
    seen.add(c.value)
    out.push(c)
  }

  if (current) add({ value: current, label: current, hint: CURRENT_HINT })

  for (const d of deps) {
    add({
      value: d.name,
      label: d.name,
      hint: d.type === 'prod' ? d.range : `${d.range} ${d.type}`,
    })
  }

  for (const n of Object.keys(pkgs).toSorted()) {
    add({ value: n, label: n, hint: pkgs[n] === 'read' ? 'read-only' : undefined })
  }
  return out
}
