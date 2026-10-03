import { queryOptions, useQueries } from '@tanstack/react-query'

import { getWorkOrders } from '@/features/work-orders/api/work-orders-collection'
import type { WorkOrder } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

/**
 * A project's work orders under the same key as its collection, so the board
 * and these cross-project lookups share one cache entry and SSE refreshes both.
 */
const projectWorkOrders = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.workOrdersByProject(projectId),
    queryFn: () => getWorkOrders(projectId),
  })

/** Work orders waiting on a person (gate or handoff review), across the given projects. */
export function useWaitingWorkOrders(projectIds: readonly string[]): WorkOrder[] {
  return useQueries({
    queries: projectIds.map(projectWorkOrders),
    combine: (results) =>
      results.flatMap((result) =>
        (result.data ?? []).filter((workOrder) => workOrder.status === 'awaiting_approval'),
      ),
  })
}
