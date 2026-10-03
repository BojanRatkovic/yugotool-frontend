import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * Query collections don't expose a reactive error, and a failed first fetch
 * leaves them "loading" forever. This reads the backing query's error instead.
 */
export function useQueryError(queryKey: QueryKey): Error | null {
  const queryClient = useQueryClient()
  const cache = queryClient.getQueryCache()
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache])
  return useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryState(queryKey)?.error ?? null,
  )
}
