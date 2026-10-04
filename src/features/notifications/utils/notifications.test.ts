import { describe, expect, it } from 'vitest'

import { formatBadgeCount, groupByDay } from '@/features/notifications/utils/notifications'
import { notification } from '@/testing/notification-fixtures'

describe('formatBadgeCount', () => {
  it('shows the exact count up to 99, then caps', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(99)).toBe('99')
    expect(formatBadgeCount(100)).toBe('99+')
    expect(formatBadgeCount(1_250)).toBe('99+')
  })
})

/** A day in October 2026 at the given hour, local time. */
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString()

describe('groupByDay', () => {
  const now = new Date(2026, 9, 4, 15, 30)

  it('splits at local midnight and keeps newest-first order', () => {
    const a = notification({ createdAt: at(4, 15) })
    const b = notification({ createdAt: at(4, 0) })
    const c = notification({ createdAt: at(3, 23) })
    const d = notification({ createdAt: at(1, 9) })

    const { today, earlier } = groupByDay([a, b, c, d], now)

    expect(today).toEqual([a, b])
    expect(earlier).toEqual([c, d])
  })

  it('returns empty groups for an empty list', () => {
    expect(groupByDay([], now)).toEqual({ today: [], earlier: [] })
  })
})
