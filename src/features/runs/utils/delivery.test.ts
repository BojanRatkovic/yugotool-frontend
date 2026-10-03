import { describe, expect, it } from 'vitest'

import {
  canOpenPullRequest,
  effectiveDelivery,
  isDeliveryGate,
} from '@/features/runs/utils/delivery'

describe('delivery', () => {
  it('falls back to a local commit when the default PR mode cannot work', () => {
    expect(effectiveDelivery('pr', null)).toEqual({ mode: 'pr', fellBack: false })
    expect(effectiveDelivery('draft_pr', 'No origin remote.')).toEqual({
      mode: 'local',
      fellBack: true,
    })
    expect(effectiveDelivery('local', 'No origin remote.')).toEqual({
      mode: 'local',
      fellBack: false,
    })
  })

  it('offers the choice at the last gate only', () => {
    const stations = [{ key: 'plan_gate' }, { key: 'build' }, { key: 'final' }]
    expect(isDeliveryGate(stations, 'final')).toBe(true)
    expect(isDeliveryGate(stations, 'plan_gate')).toBe(false)
    expect(isDeliveryGate([], 'final')).toBe(false)
  })

  it('opens a PR only for done work on a branch without one', () => {
    const done = { status: 'done', branch: 'zastava/x', prUrl: null }
    expect(canOpenPullRequest(done)).toBe(true)
    expect(canOpenPullRequest({ ...done, prUrl: 'https://github.com/o/r/pull/1' })).toBe(false)
    expect(canOpenPullRequest({ ...done, branch: null })).toBe(false)
    expect(canOpenPullRequest({ ...done, status: 'failed' })).toBe(false)
  })
})
