import { describe, expect, it } from 'vitest'

import {
  canAccept,
  defaultCheck,
  formatQaCounts,
  groupChecks,
  noVisualChanges,
  noteLines,
  qaCounts,
  qaDiffCount,
  qaFileUrl,
  qaSummaryLine,
  selectAttempt,
} from '@/features/runs/utils/qa'
import type { QaCheck, QaRun, StationRun } from '@/lib/contracts'

function check(partial: Partial<QaCheck>): QaCheck {
  return {
    id: crypto.randomUUID(),
    qaRunId: crypto.randomUUID(),
    name: 'Home',
    kind: 'visual',
    viewport: 'desktop',
    theme: 'light',
    path: '/',
    status: 'pass',
    diffPct: 0,
    baseShot: null,
    prShot: null,
    diffShot: null,
    steps: [],
    note: null,
    severity: null,
    acceptedAt: null,
    reason: null,
    position: 0,
    ...partial,
  }
}

function qaRun(attempt: number): QaRun {
  return {
    id: crypto.randomUUID(),
    runId: crypto.randomUUID(),
    stationRunId: crypto.randomUUID(),
    stationKey: 'qa',
    attempt,
    status: 'passed',
    baseSha: null,
    prSha: null,
    baseUrl: null,
    prUrl: null,
    summary: null,
    checks: [],
    startedAt: '2026-10-03T10:00:00.000Z',
    finishedAt: null,
  }
}

type QaSummary = NonNullable<StationRun['qa']>

function qa(partial: Partial<QaSummary>): { qa: QaSummary } {
  return {
    qa: {
      qaRunId: crypto.randomUUID(),
      status: 'failed',
      total: 9,
      passed: 7,
      failed: 1,
      diffs: 2,
      ...partial,
    },
  }
}

function sr(attempt: number, diffs: number | null) {
  return { stationKey: 'qa', attempt, qa: diffs === null ? null : qa({ diffs }).qa }
}

describe('qa helpers', () => {
  it('encodes file segments but keeps slashes', () => {
    expect(qaFileUrl('r1', 'qa/1/home page-desktop.png')).toBe(
      '/api/runs/r1/qa/files/qa/1/home%20page-desktop.png',
    )
  })

  it('counts and formats checks', () => {
    const checks = [
      ...Array.from({ length: 7 }, () => check({})),
      check({ status: 'fail' }),
      check({ status: 'intended' }),
      check({ status: 'intended' }),
    ]
    const counts = qaCounts(checks)
    expect(counts.total).toBe(10)
    expect(formatQaCounts(counts)).toBe('7 pass · 1 fail · 2 intended')
    expect(formatQaCounts(qaCounts([]))).toBe('No checks yet')
  })

  it('groups fail first and picks the first check needing a look', () => {
    const pass = check({ position: 0 })
    const changed = check({ status: 'changed', position: 1 })
    const fail = check({ status: 'fail', position: 2 })
    const checks = [pass, changed, fail]
    expect(groupChecks(checks).map((group) => group.status)).toEqual([
      'fail',
      'changed',
      'pass',
    ])
    expect(defaultCheck(checks, undefined)?.id).toBe(fail.id)
    expect(defaultCheck(checks, pass.id)?.id).toBe(pass.id)
    expect(defaultCheck([pass], undefined)).toBeUndefined()
  })

  it('knows when nothing visual changed and what can be accepted', () => {
    expect(noVisualChanges([check({}), check({ kind: 'console', status: 'fail' })])).toBe(true)
    expect(noVisualChanges([check({ status: 'intended' })])).toBe(false)
    expect(noVisualChanges([])).toBe(false)
    expect(canAccept({ status: 'changed' })).toBe(true)
    expect(canAccept({ status: 'intended' })).toBe(false)
  })

  it('selects an attempt, else the latest', () => {
    const runs = [qaRun(2), qaRun(1)]
    expect(selectAttempt(runs, undefined)?.attempt).toBe(2)
    expect(selectAttempt(runs, 1)?.attempt).toBe(1)
    expect(selectAttempt(runs, 9)?.attempt).toBe(2)
  })

  it('summarizes a QA station run for the stepper', () => {
    expect(qaSummaryLine(qa({}))).toBe('QA · 7/9 · 2 diffs')
    expect(qaSummaryLine(qa({ diffs: 1 }))).toBe('QA · 7/9 · 1 diff')
    expect(qaSummaryLine(qa({ status: 'running', total: 0 }))).toBe('QA · booting previews')
    expect(qaSummaryLine(qa({ status: 'error' }))).toBe('QA · error')
    expect(qaSummaryLine({ qa: null })).toBeNull()
  })

  it('sums diffs over the latest attempt of each QA station', () => {
    expect(qaDiffCount([sr(1, 4), sr(2, 1)])).toBe(1)
    expect(qaDiffCount([sr(1, null)])).toBeNull()
  })

  it('splits notes into list lines', () => {
    expect(noteLines('- TypeError: x\n\n* 404 /api/me')).toEqual([
      'TypeError: x',
      '404 /api/me',
    ])
    expect(noteLines(null)).toEqual([])
  })
})
