import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { apiClient } from '@/lib/api-client'
import {
  workOrderSchema,
  type CreateWorkOrder,
  type UpdateWorkOrder,
  type WorkOrder,
} from '@/lib/contracts'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

/** Tolerates an API that predates the queue (no `queueMode`/`queuedAt` yet). */
const workOrderResponseSchema = workOrderSchema.extend({
  queueMode: workOrderSchema.shape.queueMode.default(null),
  queuedAt: workOrderSchema.shape.queuedAt.default(null),
})

export async function getWorkOrders(projectId: string): Promise<WorkOrder[]> {
  const data = await apiClient.get(`/work-orders?projectId=${encodeURIComponent(projectId)}`)
  return workOrderResponseSchema.array().parse(data)
}

function createWorkOrdersCollection(projectId: string) {
  return createCollection(
    queryCollectionOptions({
      id: `work-orders:${projectId}`,
      queryKey: queryKeys.workOrdersByProject(projectId),
      queryFn: () => getWorkOrders(projectId),
      queryClient,
      getKey: (workOrder) => workOrder.id,
      // Client-generated ids make the POST idempotent, so a replay after a
      // dropped response can't create a duplicate.
      onInsert: async ({ transaction }) => {
        await Promise.all(
          transaction.mutations.map(({ modified }) => {
            const body: CreateWorkOrder = {
              id: modified.id,
              projectId: modified.projectId,
              title: modified.title,
              description: modified.description,
              position: modified.position,
              modelOverride: modified.modelOverride,
              effortOverride: modified.effortOverride,
              maxBudgetUsd: modified.maxBudgetUsd,
            }
            return apiClient.post('/work-orders', body)
          }),
        )
      },
      onUpdate: async ({ transaction }) => {
        await Promise.all(
          transaction.mutations.map(({ key, changes }) => {
            const body: UpdateWorkOrder = {}
            if (changes.title !== undefined) body.title = changes.title
            if (changes.description !== undefined) body.description = changes.description
            if (changes.position !== undefined) body.position = changes.position
            if (changes.modelOverride !== undefined) body.modelOverride = changes.modelOverride
            if (changes.effortOverride !== undefined)
              body.effortOverride = changes.effortOverride
            if (changes.maxBudgetUsd !== undefined) body.maxBudgetUsd = changes.maxBudgetUsd
            return apiClient.patch(`/work-orders/${key}`, body)
          }),
        )
      },
      // Idempotent server-side; 409 `work_order_active` rolls the row back.
      onDelete: async ({ transaction }) => {
        await Promise.all(
          transaction.mutations.map(({ key }) => apiClient.delete(`/work-orders/${key}`)),
        )
      },
    }),
  )
}

type WorkOrdersCollection = ReturnType<typeof createWorkOrdersCollection>

const collections = new Map<string, WorkOrdersCollection>()

/** One collection per project, created lazily and kept for the session. */
export function workOrdersCollection(projectId: string): WorkOrdersCollection {
  let collection = collections.get(projectId)
  if (collection === undefined) {
    collection = createWorkOrdersCollection(projectId)
    collections.set(projectId, collection)
  }
  return collection
}

// TODO(offline): wrap inserts/updates/deletes in @tanstack/offline-transactions so
// edits made offline queue in IndexedDB and replay on reconnect. Today an
// offline write is optimistic but rolls back when the request fails.
