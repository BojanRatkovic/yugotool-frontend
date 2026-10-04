import { describe, expect, it } from 'vitest'

import { markReadInPages } from '@/features/notifications/api/use-mark-read'
import { notification, notificationPages } from '@/testing/notification-fixtures'

const NOW = '2026-10-04T12:00:00.000Z'

describe('markReadInPages (optimistic mark read)', () => {
  it('marks the given ids read and drops the count by the ones that were unread', () => {
    const a = notification()
    const b = notification()
    const c = notification({ readAt: '2026-10-04T08:00:00.000Z' })
    const data = notificationPages({ items: [a, b], unreadCount: 7 }, { items: [c] })

    const next = markReadInPages(data, { ids: [a.id, c.id] }, NOW)

    expect(next.pages[0]?.items.map((i) => i.readAt)).toEqual([NOW, null])
    expect(next.pages[1]?.items[0]?.readAt).toBe(c.readAt)
    expect(next.pages[0]?.unreadCount).toBe(6)
  })

  it('marks every loaded one read and zeroes the count for `all`', () => {
    const data = notificationPages({ items: [notification()], unreadCount: 40 })
    const next = markReadInPages(data, { all: true }, NOW)
    expect(next.pages[0]?.items[0]?.readAt).toBe(NOW)
    expect(next.pages[0]?.unreadCount).toBe(0)
  })
})
