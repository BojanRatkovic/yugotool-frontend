import { describe, expect, it } from 'vitest'

import { stoppedLabel } from '@/features/work-orders/utils/card-outcome'
import { REPO_HOOKS_STATION_KEY } from '@/lib/contracts'

const stations = [
  { key: 'build', kind: 'agent', name: 'Build' },
  { key: 'qa', kind: 'qa', name: 'QA' },
  { key: 'review_gate', kind: 'gate', name: 'Final review' },
] as const

describe('stoppedLabel', () => {
  it('names the station the order stopped at', () => {
    expect(stoppedLabel({ status: 'failed', stationKey: 'qa' }, stations)).toBe('Failed at QA')
    expect(stoppedLabel({ status: 'cancelled', stationKey: 'build' }, stations)).toBe(
      'Cancelled at Build',
    )
    expect(stoppedLabel({ status: 'rejected', stationKey: 'review_gate' }, stations)).toBe(
      'Rejected at Final review',
    )
  })

  it('reads a failure at a gate as a failed delivery', () => {
    expect(stoppedLabel({ status: 'failed', stationKey: 'review_gate' }, stations)).toBe(
      'Delivery failed',
    )
    expect(
      stoppedLabel({ status: 'failed', stationKey: REPO_HOOKS_STATION_KEY }, stations),
    ).toBe('Failed at repo hooks')
  })

  it('names a station the line no longer has from its key', () => {
    expect(stoppedLabel({ status: 'failed', stationKey: 'research' }, stations)).toBe(
      'Failed at Research',
    )
    expect(stoppedLabel({ status: 'cancelled', stationKey: 'old_review' }, stations)).toBe(
      'Cancelled at Old review',
    )
  })

  it('falls back to the plain word for an unknown station, and null for live orders', () => {
    expect(stoppedLabel({ status: 'failed', stationKey: null }, stations)).toBe('Failed')
    expect(stoppedLabel({ status: 'running', stationKey: 'build' }, stations)).toBeNull()
    expect(stoppedLabel({ status: 'done', stationKey: null }, stations)).toBeNull()
  })
})
