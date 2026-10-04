import type { InfiniteData } from '@tanstack/react-query'

import type { Notification, NotificationPage } from '@/lib/contracts'

let seq = 0

/** A notification with a fresh id; override what the test is about. */
export function notification(overrides: Partial<Notification> = {}): Notification {
  seq += 1
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    kind: 'gate_waiting',
    title: 'Fix login waits for you at Review',
    body: 'Approve, request changes or reject.',
    path: '/projects/0e6b2c1a-1111-4222-8333-444455556666?view=board',
    projectId: null,
    workOrderId: null,
    readAt: null,
    createdAt: '2026-10-04T10:00:00.000Z',
    ...overrides,
  }
}

/** The bell's cached infinite list, one page per argument. */
export function notificationPages(
  ...pages: { items: Notification[]; unreadCount?: number; nextCursor?: string | null }[]
): InfiniteData<NotificationPage, string | null> {
  return {
    pages: pages.map((page) => ({
      items: page.items,
      unreadCount: page.unreadCount ?? page.items.filter((item) => item.readAt === null).length,
      nextCursor: page.nextCursor ?? null,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? null : `cursor-${index}`)),
  }
}
