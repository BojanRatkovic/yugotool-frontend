import { describe, expect, it } from 'vitest'

import { pickedSources, syncedLine } from '@/features/knowledge/utils/knowledge'
import type { KnowledgeSource } from '@/lib/contracts'

const source = (patch: Partial<KnowledgeSource>): KnowledgeSource => ({
  id: crypto.randomUUID(),
  name: 'work',
  kind: 'git_local',
  location: '~/work',
  branch: null,
  entryFile: null,
  excludes: [],
  lastSyncedSha: null,
  lastSyncedAt: null,
  lastEntryFile: null,
  lastError: null,
  createdAt: '2026-10-03T10:00:00.000Z',
  updatedAt: '2026-10-03T10:00:00.000Z',
  ...patch,
})

describe('syncedLine', () => {
  it('says what was read and where it starts', () => {
    const now = Date.parse('2026-10-03T10:03:00.000Z')
    const synced = source({
      lastSyncedSha: 'a1b2c3d4e5f6',
      lastSyncedAt: '2026-10-03T10:00:00.000Z',
      lastEntryFile: 'knowledge/INDEX.md',
    })
    expect(syncedLine(synced, now)).toBe(
      'Synced a1b2c3d · 3 min ago · starts at knowledge/INDEX.md',
    )
    expect(syncedLine(source({}), now)).toBe('Not synced yet')
  })
})

describe('pickedSources', () => {
  it('keeps the project order and drops deleted sources', () => {
    const a = source({ name: 'a' })
    const b = source({ name: 'b' })
    expect(pickedSources([a, b], [b.id, 'gone', a.id]).map((s) => s.name)).toEqual(['b', 'a'])
  })
})
