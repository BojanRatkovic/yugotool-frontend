import { eq, useLiveQuery } from '@tanstack/react-db'

import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'

/** Live lookup of one work order. */
export function useWorkOrder(projectId: string, workOrderId: string) {
  const collection = workOrdersCollection(projectId)
  const { data, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ row: collection })
        .where(({ row }) => eq(row.id, workOrderId))
        .findOne(),
    [collection, workOrderId],
  )
  return { workOrder: data, isLoading }
}

/** All work orders of a project (command palette, J/K order). */
export function useWorkOrders(projectId: string) {
  const collection = workOrdersCollection(projectId)
  const { data } = useLiveQuery((q) => q.from({ row: collection }), [collection])
  return data
}
