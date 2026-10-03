import { describe, expect, it } from 'vitest'

import { dispatcherReason } from '@/features/system/components/dispatcher-card'
import type { DispatcherState } from '@/lib/contracts'

const base: DispatcherState = {
  status: 'paused_usage',
  reason: 'Paused — 5-hour usage 87%',
  running: 0,
  queued: 3,
  queuedNight: 0,
  slots: 2,
  inNightShift: false,
  resumesAt: null,
  checkedAt: '2026-10-02T10:00:00.000Z',
}

describe('dispatcherReason', () => {
  it('appends the resume time when the server did not', () => {
    const resumesAt = new Date(2026, 9, 3, 1, 0).toISOString()
    expect(dispatcherReason({ ...base, resumesAt })).toBe(
      'Paused — 5-hour usage 87% · resumes 01:00',
    )
  })

  it('keeps a reason that already says when it resumes', () => {
    const reason = 'Paused — 5-hour usage 87% · resumes 01:00'
    expect(dispatcherReason({ ...base, reason, resumesAt: new Date().toISOString() })).toBe(
      reason,
    )
  })

  it('falls back to the status word on an empty reason', () => {
    expect(dispatcherReason({ ...base, status: 'idle', reason: '' })).toBe('Idle')
  })
})
