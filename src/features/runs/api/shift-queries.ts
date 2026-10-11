import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import {
  runMemorySchema,
  shiftSchema,
  type RunMemory,
  type Shift,
  type ShiftReview,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getShifts(runId: string): Promise<Shift[]> {
  const data = await apiClient.get(`/runs/${runId}/shifts`)
  return shiftSchema.array().parse(data)
}

async function getMemory(runId: string): Promise<RunMemory> {
  const data = await apiClient.get(`/runs/${runId}/memory`)
  return runMemorySchema.parse(data)
}

export const shiftQueries = {
  /** Every shift of the run, ordered by number. SSE `shifts` refreshes it. */
  list: (runId: string) =>
    queryOptions({
      queryKey: queryKeys.runShifts(runId),
      queryFn: () => getShifts(runId),
    }),
  /**
   * `.yugotool/` from the worktree. The agent edits tasks.json between SSE
   * nudges, so callers poll it (`refetchInterval`) while a shift is running.
   * 409 `workspace_gone` once the worktree is cleaned up — no point retrying.
   */
  memory: (runId: string) =>
    queryOptions({
      queryKey: queryKeys.runMemory(runId),
      queryFn: () => getMemory(runId),
      retry: false,
    }),
}

function useShiftMutation<TBody>(runId: string, path: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TBody) => apiClient.post(`/runs/${runId}/shifts/${path}`, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.runs() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() }),
      ]),
  })
}

/** Force a handoff at the running shift's next turn boundary. */
export function useHandoffNow(runId: string) {
  return useShiftMutation<undefined>(runId, 'handoff-now')
}

/** Let the running shift finish, then stop the station. */
export function useStopAfterShift(runId: string) {
  return useShiftMutation<undefined>(runId, 'stop-after')
}

/** Continue (optionally with an edited handoff) or stop, for a shift awaiting review. */
export function useShiftReview(runId: string) {
  return useShiftMutation<ShiftReview>(runId, 'review')
}
