import { infiniteQueryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { notificationPageSchema, type NotificationPage } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

const PAGE_SIZE = 20

async function getPage(before: string | null): Promise<NotificationPage> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (before !== null) query.set('before', before)
  return notificationPageSchema.parse(await apiClient.get(`/notifications?${query}`))
}

/**
 * The bell's list, newest first. New ones arrive over SSE and are prepended to
 * the first page (`lib/realtime.ts`); read-state changes invalidate the root.
 */
export const notificationQueries = {
  all: () => queryKeys.notifications(),
  list: () =>
    infiniteQueryOptions({
      queryKey: queryKeys.notificationList(),
      queryFn: ({ pageParam }) => getPage(pageParam),
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
      staleTime: 60_000,
    }),
}
