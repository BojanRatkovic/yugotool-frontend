import { describe, expect, it } from 'vitest'

import {
  BACKLOG,
  buildColumns,
  DONE,
  positionBetween,
} from '@/features/work-orders/utils/board-columns'
import type { Station, WorkOrder } from '@/lib/contracts'

const stations: Station[] = [
  {
    key: 'research',
    kind: 'agent',
    name: 'Research',
    role: 'r',
    model: 'm',
    allowedTools: [],
    canEdit: false,
    prompt: '',
  },
  { key: 'plan_gate', kind: 'gate', name: 'Approve plan', prompt: '' },
]

function wo(patch: Partial<WorkOrder>): WorkOrder {
  return {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    kind: 'build',
    title: 't',
    description: '',
    pullRequest: null,
    status: 'backlog',
    stationKey: null,
    position: 1,
    repo: null,
    followsId: null,
    branch: null,
    currentRunId: null,
    queueMode: null,
    queuedAt: null,
    source: null,
    modelOverride: null,
    effortOverride: null,
    maxBudgetUsd: null,
    prUrl: null,
    ci: null,
    createdAt: '2026-10-02T00:00:00Z',
    updatedAt: '2026-10-02T00:00:00Z',
    ...patch,
  }
}

describe('buildColumns', () => {
  it('places work orders by status and station', () => {
    const columns = buildColumns(stations, [
      wo({ title: 'a' }),
      wo({ title: 'b', status: 'awaiting_approval', stationKey: 'plan_gate' }),
      wo({ title: 'c', status: 'failed', stationKey: 'research' }),
      wo({ title: 'd', status: 'done' }),
    ])
    const titles = Object.fromEntries(columns.map((c) => [c.key, c.items.map((i) => i.title)]))
    expect(titles).toEqual({
      [BACKLOG]: ['a'],
      research: ['c'],
      plan_gate: ['b'],
      [DONE]: ['d'],
    })
  })
})

describe('buildColumns · queue', () => {
  it('keeps queued orders in the backlog column', () => {
    const queued = wo({ status: 'queued', queueMode: 'night' })
    const columns = buildColumns(stations, [queued])
    expect(columns[0]?.key).toBe(BACKLOG)
    expect(columns[0]?.items).toEqual([queued])
  })
})

describe('positionBetween', () => {
  it('picks the midpoint or extends past the ends', () => {
    expect(positionBetween(1, 2)).toBe(1.5)
    expect(positionBetween(undefined, 2)).toBe(1)
    expect(positionBetween(3, undefined)).toBe(4)
  })
})
