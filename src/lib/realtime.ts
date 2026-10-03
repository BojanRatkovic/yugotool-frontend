import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { env } from '@/config/env'
import { serverEventSchema, type CollectionName } from '@/lib/contracts'
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
}

/**
 * Subscribes to the API's SSE stream and turns server events into cache
 * invalidations. Collections are backed by these query keys, so they refetch
 * too. EventSource reconnects on its own; on reconnect everything is
 * invalidated because events may have been missed.
 */
export function useRealtime() {
  const queryClient = useQueryClient()

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
      }
      // `notice` is for the desktop shell, which shows it natively; the web app ignores it.
    })

    return () => source.close()
  }, [queryClient])
}
