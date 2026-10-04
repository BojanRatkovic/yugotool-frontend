import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query'

import { notificationQueries } from '@/features/notifications/api/notifications-queries'
import { apiClient } from '@/lib/api-client'
import {
  type MarkNotificationsRead,
  type NotificationPage,
  unreadCountSchema,
} from '@/lib/contracts'

/** Marks the given ids (or every one) read in the cached pages; the count drops with them. */
export function markReadInPages<Param>(
  data: InfiniteData<NotificationPage, Param>,
  input: MarkNotificationsRead,
  now: string,
): InfiniteData<NotificationPage, Param> {
  const ids = input.ids === undefined ? null : new Set(input.ids)
  let marked = 0
  const pages = data.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.readAt !== null || (ids !== null && !ids.has(item.id))) return item
      marked += 1
      return { ...item, readAt: now }
    }),
  }))
  const [first, ...rest] = pages
  if (first === undefined) return data
  const unreadCount = ids === null ? 0 : Math.max(0, first.unreadCount - marked)
  return { ...data, pages: [{ ...first, unreadCount }, ...rest] }
}

/** Read state flips at once and rolls back on failure; the server's count wins after. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  const { queryKey } = notificationQueries.list()
  return useMutation({
    mutationFn: async (input: MarkNotificationsRead) =>
      unreadCountSchema.parse(await apiClient.post('/notifications/read', input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      if (previous !== undefined) {
        queryClient.setQueryData(
          queryKey,
          markReadInPages(previous, input, new Date().toISOString()),
        )
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationQueries.all() }),
  })
}
