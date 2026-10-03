import { QueryCache, QueryClient } from '@tanstack/react-query'

import { env } from '@/config/env'

/** Persisted cache must outlive a browser restart for the board to render offline. */
export const CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7

export const queryClient = new QueryClient({
  // Central error handling — fires once per failed request, not per observer.
  queryCache: new QueryCache({
    onError: (error) => {
      if (env.DEV) console.error('[query]', error)
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      gcTime: CACHE_MAX_AGE,
      // Offline-first: serve cached data, refetch when back online.
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
})
