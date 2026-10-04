import type { Notification } from '@/lib/contracts'

/** The bell's badge: the exact count up to 99, then `99+`. */
export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

/** Splits a newest-first list into today's (local calendar day) and the rest, order kept. */
export function groupByDay(
  items: readonly Notification[],
  now = new Date(),
): { today: Notification[]; earlier: Notification[] } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const today: Notification[] = []
  const earlier: Notification[] = []
  for (const item of items) {
    ;(new Date(item.createdAt).getTime() >= startOfToday ? today : earlier).push(item)
  }
  return { today, earlier }
}
