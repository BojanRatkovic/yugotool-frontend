import type { KnowledgeSource, KnowledgeSourceKind } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'

export const KIND_LABEL: Record<KnowledgeSourceKind, string> = {
  git_local: 'Local git repo',
  git_remote: 'Git URL',
  path: 'Folder or file',
}

/** "Synced a1b2c3d · 3 min ago · starts at knowledge/INDEX.md", or "Not synced yet". */
export function syncedLine(source: KnowledgeSource, now = Date.now()): string {
  if (source.lastSyncedAt === null) return 'Not synced yet'
  const sha = source.lastSyncedSha === null ? '' : ` ${source.lastSyncedSha.slice(0, 7)}`
  const entry = source.lastEntryFile === null ? '' : ` · starts at ${source.lastEntryFile}`
  return `Synced${sha} · ${formatRelative(source.lastSyncedAt, now)}${entry}`
}

/** The sources in the project's order; ids that no longer exist are dropped. */
export function pickedSources(all: KnowledgeSource[], ids: string[]): KnowledgeSource[] {
  const byId = new Map(all.map((source) => [source.id, source]))
  return ids.flatMap((id) => {
    const source = byId.get(id)
    return source === undefined ? [] : [source]
  })
}
