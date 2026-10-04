import { type InfiniteData, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { NotificationPage } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'
import { prependNotification } from '@/lib/realtime'
import { notification, notificationPages } from '@/testing/notification-fixtures'

const read = (client: QueryClient) =>
  client.getQueryData<InfiniteData<NotificationPage, string | null>>(
    queryKeys.notificationList(),
  )

describe('prependNotification (SSE `notification`)', () => {
  it('puts the new one first on the first page and bumps the unread count', () => {
    const client = new QueryClient()
    const older = notification({ readAt: '2026-10-04T09:00:00.000Z' })
    const second = notification()
    client.setQueryData(
      queryKeys.notificationList(),
      notificationPages(
        { items: [older], unreadCount: 4, nextCursor: older.id },
        { items: [second] },
      ),
    )
    const fresh = notification()

    expect(prependNotification(client, fresh)).toBe(true)

    const data = read(client)
    expect(data?.pages[0]?.items.map((i) => i.id)).toEqual([fresh.id, older.id])
    expect(data?.pages[0]?.unreadCount).toBe(5)
    expect(data?.pages[0]?.nextCursor).toBe(older.id)
    expect(data?.pages[1]?.items).toEqual([second])
  })

  it('ignores one the cache already holds, on any page', () => {
    const client = new QueryClient()
    const onSecondPage = notification()
    client.setQueryData(
      queryKeys.notificationList(),
      notificationPages({ items: [notification()] }, { items: [onSecondPage] }),
    )
    const before = read(client)

    expect(prependNotification(client, onSecondPage)).toBe(false)
    expect(read(client)).toBe(before)
  })

  it('does not count an already-read one as unread', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.notificationList(), notificationPages({ items: [] }))
    prependNotification(client, notification({ readAt: '2026-10-04T10:00:00.000Z' }))
    expect(read(client)?.pages[0]?.unreadCount).toBe(0)
  })

  it('leaves an unloaded list alone (the first fetch brings it) but still reports it new', () => {
    const client = new QueryClient()
    expect(prependNotification(client, notification())).toBe(true)
    expect(read(client)).toBeUndefined()
  })
})
