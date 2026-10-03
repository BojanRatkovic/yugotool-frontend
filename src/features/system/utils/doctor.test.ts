import { describe, expect, it } from 'vitest'

import { blockingChecks, joinLabels, notReadyMessage } from '@/features/system/utils/doctor'
import type { DoctorCheck, DoctorReport } from '@/lib/contracts'

function check(patch: Partial<DoctorCheck>): DoctorCheck {
  return {
    key: 'git',
    label: 'git',
    status: 'ok',
    required: true,
    detail: 'git 2.47.1',
    neededFor: null,
    fix: null,
    fixCommand: null,
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
      check({ key: 'git', label: 'git', status: 'warn' }),
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
