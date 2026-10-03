import { useMutation, useQueryClient } from '@tanstack/react-query'

import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import type { QueueMode } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

/** Board, runs and the dispatcher card all move when an order starts or (de)queues. */
function useInvalidateLine() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.runs() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatcher() }),
    ])
}

function useWorkOrderCommand(command: 'start' | 'cancel' | 'dequeue') {
  const invalidate = useInvalidateLine()
  return useMutation({
    mutationFn: ({ workOrderId }: { workOrderId: string }) =>
      apiClient.post(`/work-orders/${workOrderId}/${command}`),
    onSuccess: invalidate,
  })
}

export function useStartWorkOrder() {
  return useWorkOrderCommand('start')
}

export function useCancelWorkOrder() {
  return useWorkOrderCommand('cancel')
}

/** Hands the order to the dispatcher: next free slot (`asap`) or the night shift. */
export function useEnqueueWorkOrder() {
  const invalidate = useInvalidateLine()
  return useMutation({
    mutationFn: ({ workOrderId, mode }: { workOrderId: string; mode: QueueMode }) =>
      apiClient.post(`/work-orders/${workOrderId}/enqueue`, { mode }),
    onSuccess: invalidate,
  })
}

/** Back to the backlog. */
export function useDequeueWorkOrder() {
  return useWorkOrderCommand('dequeue')
}

const runBacklogResponseSchema = z.object({ queued: z.number().int() })

/** Queues every backlog order of a project; resolves to how many were queued. */
export function useRunBacklog() {
  const invalidate = useInvalidateLine()
  return useMutation({
    mutationFn: async ({ projectId, mode }: { projectId: string; mode: QueueMode }) => {
      const data = await apiClient.post(`/projects/${projectId}/run-backlog`, { mode })
      return runBacklogResponseSchema.parse(data).queued
    },
    onSuccess: invalidate,
  })
}

/** Opens the order's worktree in VS Code on the machine running the API. */
export function useOpenInEditor() {
  return useMutation({
    mutationFn: ({ workOrderId }: { workOrderId: string }) =>
      apiClient.post(`/work-orders/${workOrderId}/open-editor`),
  })
}
