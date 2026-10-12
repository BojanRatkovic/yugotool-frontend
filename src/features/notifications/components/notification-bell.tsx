import { useInfiniteQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { notificationQueries } from '@/features/notifications/api/notifications-queries'
import { NotificationList } from '@/features/notifications/components/notification-list'
import { formatBadgeCount } from '@/features/notifications/utils/notifications'

/** "Notifications, 3 unread" — the count read out, never the capped badge. */
function bellLabel(unreadCount: number): string {
  return unreadCount === 0 ? 'Notifications' : `Notifications, ${unreadCount} unread`
}

/** Bell with the unread count; opens the list. `onOpen` navigates to an in-app path. */
export function NotificationBell({ onOpen }: { onOpen: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  // Same key as the list: the first page's count, no extra request.
  const unread = useInfiniteQuery({
    ...notificationQueries.list(),
    select: (data) => data.pages[0]?.unreadCount ?? 0,
  })
  const unreadCount = unread.data ?? 0
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={bellLabel(unreadCount)}
          className="relative"
        >
          <Bell aria-hidden="true" />
          {unreadCount === 0 ? null : (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[0.625rem] font-semibold text-white tabular-nums"
            >
              {formatBadgeCount(unreadCount)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 gap-0 p-0">
        <NotificationList
          onOpen={(path) => {
            setOpen(false)
            onOpen(path)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
