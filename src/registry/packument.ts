export interface PackumentVersion {
  version: string
  deprecated?: string
}

export interface Packument {
  name: string
  'dist-tags': Record<string, string>
  versions: Record<string, PackumentVersion>
  time: Record<string, string>
  maintainers?: { name: string; email?: string }[]
  description?: string
  repository?: { url?: string } | string
}

export interface VersionInfo {
  version: string
  time: string | undefined
  tags: string[]
  deprecated: string | undefined
}

export interface PackageSummary {
  name: string
  latest: string | undefined
  distTags: Record<string, string>
  versions: VersionInfo[]
  created: string | undefined
  lastPublished: string | undefined
  deprecatedCount: number
  latestDeprecated: boolean
  maintainers: string[]
  description: string | undefined
}

export function summarize(doc: Packument): PackageSummary {
  const tagsByVersion = new Map<string, string[]>()
  for (const [tag, v] of Object.entries(doc['dist-tags'] ?? {})) {
    tagsByVersion.set(v, [...(tagsByVersion.get(v) ?? []), tag])
  }
  const time = doc.time ?? {}
  const versions: VersionInfo[] = Object.values(doc.versions ?? {})
    .map((v) => ({
      version: v.version,
      time: time[v.version],
      tags: tagsByVersion.get(v.version) ?? [],
      deprecated: v.deprecated,
    }))
    .toSorted((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
  const latest = doc['dist-tags']?.latest
  return {
    name: doc.name,
    latest,
    distTags: doc['dist-tags'] ?? {},
    versions,
    created: time.created,
    lastPublished: versions[0]?.time,
    deprecatedCount: versions.filter((v) => v.deprecated !== undefined).length,
    latestDeprecated: latest !== undefined && doc.versions[latest]?.deprecated !== undefined,
    maintainers: (doc.maintainers ?? []).map((m) => m.name),
    description: doc.description,
  }
}
