import { describe, expect, it } from 'vitest'

import {
  blockingChecks,
  doctorRows,
  doctorSummary,
  joinLabels,
  notReadyMessage,
} from '@/features/system/utils/doctor'
import type { DoctorCheck, DoctorReport } from '@/lib/contracts'

function check(patch: Partial<DoctorCheck>): DoctorCheck {
  return {
    key: 'git',
    label: 'Git',
    status: 'ok',
    required: true,
    detail: 'Git 2.47.1',
    neededFor: null,
    fix: null,
    fixCommand: null,
    group: 'machine',
    ...patch,
  }
}

function report(checks: DoctorCheck[]): DoctorReport {
  return {
    ready: checks.every((c) => !c.required || c.status !== 'fail'),
    checks,
    checkedAt: '2026-10-03T10:00:00.000Z',
  }
}

describe('doctor', () => {
  it('lists only failing required checks as blocking', () => {
    const r = report([
      check({ key: 'claude', label: 'Claude', status: 'fail' }),
      check({ key: 'gh', label: 'GitHub CLI', status: 'warn', required: false }),
      check({ key: 'git', label: 'Git', status: 'warn' }),
    ])
    expect(blockingChecks(r).map((c) => c.key)).toEqual(['claude'])
  })

  it('names the blocking checks in the banner', () => {
    const r = report([
      check({ key: 'claude', label: 'Claude', status: 'fail' }),
      check({ key: 'temporal', label: 'Temporal', status: 'fail' }),
      check({ key: 'worker', label: 'Worker', status: 'fail' }),
    ])
    expect(notReadyMessage(r)).toBe('ZASTAVA can’t run work yet: Claude, Temporal and Worker.')
  })

  it('stays quiet when only optional checks warn', () => {
    const r = report([check({ key: 'gh', status: 'warn', required: false })])
    expect(notReadyMessage(r)).toBeNull()
  })

  it('joins labels in prose', () => {
    expect(joinLabels([])).toBe('')
    expect(joinLabels(['Claude'])).toBe('Claude')
    expect(joinLabels(['Claude', 'Worker'])).toBe('Claude and Worker')
  })
})

describe('doctorSummary', () => {
  it('folds an all-green report', () => {
    expect(
      doctorSummary(
        report([check({}), check({ key: 'gh', label: 'GitHub CLI', required: false })]),
      ),
    ).toEqual({
      tone: 'ok',
      text: 'All 2 checks pass',
      openByDefault: false,
    })
  })

  it('names optional gaps but stays folded', () => {
    const r = report([
      check({}),
      check({ key: 'gh', label: 'GitHub CLI', required: false, status: 'warn' }),
    ])
    expect(doctorSummary(r)).toEqual({
      tone: 'warn',
      text: '1 of 2 OK · limited: GitHub CLI',
      openByDefault: false,
    })
  })

  it('opens when a required check fails', () => {
    const r = report([
      check({ key: 'claude', label: 'Claude', status: 'fail' }),
      check({ key: 'worker', label: 'Worker', status: 'fail' }),
    ])
    expect(doctorSummary(r)).toEqual({
      tone: 'fail',
      text: 'Claude and Worker block runs',
      openByDefault: true,
    })
  })
})

describe('doctorRows (spec 0013)', () => {
  const services = [
    check({ key: 'database', label: 'Database', group: 'service', detail: 'Postgres 14.18' }),
    check({ key: 'temporal', label: 'Temporal', group: 'service' }),
    check({ key: 'worker', label: 'Worker', group: 'service' }),
  ]

  it('folds running services into one row after the machine checks', () => {
    const rows = doctorRows(report([check({}), ...services]))
    expect(rows.map((row) => row.kind)).toEqual(['check', 'services'])
  })

  it('shows every service on its own once one is down', () => {
    const down = services.map((s) =>
      s.key === 'worker' ? { ...s, status: 'fail' as const } : s,
    )
    const rows = doctorRows(report([check({}), ...down]))
    expect(rows.map((row) => (row.kind === 'check' ? row.check.key : row.kind))).toEqual([
      'git',
      'database',
      'temporal',
      'worker',
    ])
  })
})
