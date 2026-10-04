import { useInfiniteQuery } from '@tanstack/react-query'
import { CheckCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { notificationQueries } from '@/features/notifications/api/notifications-queries'
import { useMarkRead } from '@/features/notifications/api/use-mark-read'
import { BrowserNotificationsSwitch } from '@/features/notifications/components/browser-notifications-switch'
import { NotificationKindIcon } from '@/features/notifications/components/notification-kind-icon'
import { groupByDay } from '@/features/notifications/utils/notifications'
import { useNow } from '@/hooks/use-now'
import type { Notification } from '@/lib/contracts'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

function NotificationItem({
  notification,
  now,
  onSelect,
}: {
  notification: Notification
  now: number
  onSelect: (notification: Notification) => void
}) {
  const unread = notification.readAt === null
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className={cn(
          'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
          !unread && 'text-muted-foreground',
        )}
      >
        <NotificationKindIcon kind={notification.kind} className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate text-[0.8125rem]', unread && 'font-medium')}>
            {notification.title}
          </span>
          {notification.body === '' ? null : (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {notification.body}
            </span>
          )}
          <time
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt)}
            className="text-[0.6875rem] text-muted-foreground tabular-nums"
          >
            {formatRelative(notification.createdAt, now)}
          </time>
        </span>
        {unread ? (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand">
            <span className="sr-only">Unread</span>
          </span>
        ) : null}
      </button>
    </li>
  )
}

function Group({
  label,
  items,
  now,
  onSelect,
}: {
  label: string
  items: Notification[]
  now: number
  onSelect: (notification: Notification) => void
}) {
  if (items.length === 0) return null
  return (
    <section aria-label={label} className="flex flex-col gap-0.5">
      <h3 className="label-caps px-2 pt-2 pb-1 text-muted-foreground">{label}</h3>
      <ul className="flex flex-col">
        {items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            now={now}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * The bell's popover body: newest first, grouped Today / Earlier. Picking one
 * marks it read and opens its page.
 */
export function NotificationList({ onOpen }: { onOpen: (path: string) => void }) {
  const list = useInfiniteQuery(notificationQueries.list())
  const markRead = useMarkRead()
  const now = useNow(30_000, true)
  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  const unreadCount = list.data?.pages[0]?.unreadCount ?? 0
  const { today, earlier } = groupByDay(items, new Date(now))

  const select = (notification: Notification) => {
    if (notification.readAt === null) markRead.mutate({ ids: [notification.id] })
    onOpen(notification.path)
  }

  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <Button
          variant="ghost"
          size="xs"
          disabled={unreadCount === 0}
          onClick={() => markRead.mutate({ all: true })}
        >
          <CheckCheck aria-hidden="true" />
          Mark all read
        </Button>
      </div>
      {/* Radix wraps the viewport's content in `display: table`, which lets long titles
          widen the rows past the popover; block keeps `truncate` working. */}
      <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-[min(28rem,70svh)] [&>[data-slot=scroll-area-viewport]>div]:!block">
        <div className="flex flex-col p-1.5">
          {list.isPending ? (
            <div className="flex flex-col gap-3 p-2" aria-label="Loading notifications">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : list.isError && items.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Couldn’t load notifications. {list.error.message}
            </p>
          ) : items.length === 0 ? (
            <div className="flex flex-col gap-1 px-2 py-8 text-center">
              <p className="text-[0.8125rem] font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">
                Gates waiting on you, failed runs and CI results show up here.
              </p>
            </div>
          ) : (
            <>
              <Group label="Today" items={today} now={now} onSelect={select} />
              <Group label="Earlier" items={earlier} now={now} onSelect={select} />
              {list.hasNextPage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 text-muted-foreground"
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                >
                  {list.isFetchingNextPage ? 'Loading older notifications' : 'Load more'}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
      <BrowserNotificationsSwitch />
    </div>
  )
}
