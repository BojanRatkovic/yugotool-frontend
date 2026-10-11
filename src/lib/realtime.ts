import { type InfiniteData, type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { env } from '@/config/env'
import {
  serverEventSchema,
  type CollectionName,
  type Notification,
  type NotificationPage,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

const COLLECTION_KEYS: Record<CollectionName, readonly (readonly string[])[]> = {
  // The root covers project-scoped keys too: preview status, routes, the sign-in session.
  projects: [queryKeys.projects()],
  work_orders: [queryKeys.workOrders()],
  // A station run changing (status, context) can mean a shift changed too.
  runs: [queryKeys.runs(), queryKeys.shifts(), queryKeys.qa()],
  settings: [queryKeys.settings()],
  dispatcher: [queryKeys.dispatcher()],
  shifts: [queryKeys.shifts()],
  qa: [queryKeys.qa()],
  knowledge_sources: [queryKeys.knowledge()],
  reviews: [queryKeys.zastavaReviews()],
  notifications: [queryKeys.notifications()],
  // An account's plan or login changing moves the usage meter too.
  claude_accounts: [queryKeys.claudeAccounts(), queryKeys.systemUsage()],
}

/**
 * Puts a new notification at the top of the bell's cached first page and bumps
 * the unread count — no refetch. Skipped when the list isn't loaded yet (the
 * first fetch brings it) or already holds it (dedupe by id). Returns false
 * for a duplicate, so it isn't toasted twice.
 */
export function prependNotification(queryClient: QueryClient, notification: Notification) {
  let duplicate = false
  queryClient.setQueryData<InfiniteData<NotificationPage, string | null>>(
    queryKeys.notificationList(),
    (data) => {
      const [first, ...rest] = data?.pages ?? []
      if (data === undefined || first === undefined) return data
      if (data.pages.some((page) => page.items.some((item) => item.id === notification.id))) {
        duplicate = true
        return data
      }
      const unread = notification.readAt === null ? 1 : 0
      return {
        ...data,
        pages: [
          {
            ...first,
            items: [notification, ...first.items],
            unreadCount: first.unreadCount + unread,
          },
          ...rest,
        ],
      }
    },
  )
  return !duplicate
}

/**
 * Subscribes to the API's SSE stream and turns server events into cache
 * invalidations. Collections are backed by these query keys, so they refetch
 * too. EventSource reconnects on its own; on reconnect everything is
 * invalidated because events may have been missed.
 */
export function useRealtime({
  onNotification,
}: {
  /** A new notification arrived (after the cache update) — the app layer toasts it. */
  onNotification?: (notification: Notification) => void
} = {}) {
  const queryClient = useQueryClient()
  const onNotificationRef = useRef(onNotification)
  useEffect(() => {
    onNotificationRef.current = onNotification
  })

  useEffect(() => {
    const source = new EventSource(`${env.API_URL}/events`)
    let wasOpen = false

    source.addEventListener('open', () => {
      if (wasOpen) void queryClient.invalidateQueries()
      wasOpen = true
    })

    source.addEventListener('message', (message: MessageEvent<string>) => {
      let json: unknown
      try {
        json = JSON.parse(message.data)
      } catch {
        return
      }
      const parsed = serverEventSchema.safeParse(json)
      if (!parsed.success) return
      const event = parsed.data
      if (event.type === 'invalidate') {
        for (const queryKey of COLLECTION_KEYS[event.collection]) {
          void queryClient.invalidateQueries({ queryKey })
        }
      } else if (event.type === 'run_event') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.runEvents(event.runId) })
      } else if (event.type === 'notification') {
        if (prependNotification(queryClient, event.notification)) {
          onNotificationRef.current?.(event.notification)
        }
      }
      // `notice` is for the desktop shell, which shows it natively; the web app ignores it.
    })

    return () => source.close()
  }, [queryClient])
}
