import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import {
  runDiffSchema,
  runEventSchema,
  runSchema,
  type GateDecision,
  type Run,
  type RunDiff,
  type RunEvent,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getRuns(workOrderId: string): Promise<Run[]> {
  const data = await apiClient.get(`/runs?workOrderId=${encodeURIComponent(workOrderId)}`)
  return runSchema.array().parse(data)
}

async function getRunEvents(runId: string, afterSeq: number): Promise<RunEvent[]> {
  const data = await apiClient.get(`/runs/${runId}/events?afterSeq=${afterSeq}&limit=1000`)
  return runEventSchema.array().parse(data)
}

async function getRunDiff(runId: string): Promise<RunDiff> {
  const data = await apiClient.get(`/runs/${runId}/diff`)
  return runDiffSchema.parse(data)
}

export const runQueries = {
  /** Worktree diff against the base branch. Keyed under `runs`, so SSE refreshes it. */
  diff: (runId: string) =>
    queryOptions({
      queryKey: queryKeys.runDiff(runId),
      queryFn: () => getRunDiff(runId),
      staleTime: 10_000,
    }),
  list: (workOrderId: string) =>
    queryOptions({
      queryKey: queryKeys.runsByWorkOrder(workOrderId),
      queryFn: () => getRuns(workOrderId),
    }),
  events: (runId: string) =>
    queryOptions({
      queryKey: queryKeys.runEvents(runId),
      // The log is append-only: fetch only what's after the last cached seq
      // and append, so an SSE nudge per event stays cheap.
      queryFn: async ({ client, queryKey }) => {
        const cached = client.getQueryData<RunEvent[]>(queryKey) ?? []
        const afterSeq = cached.at(-1)?.seq ?? 0
        const fresh = await getRunEvents(runId, afterSeq)
        return fresh.length === 0 ? cached : [...cached, ...fresh]
      },
    }),
}

/** The latest run — the one the board reflects. */
function latestRun(runs: Run[]): Run | undefined {
  return runs.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

/** The run being viewed: an explicit one from run history, else the latest. */
export function selectRun(runs: Run[], runId: string | undefined): Run | undefined {
  return (
    (runId === undefined ? undefined : runs.find((run) => run.id === runId)) ?? latestRun(runs)
  )
}

export function useGateDecision(runId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ stationKey, ...body }: GateDecision & { stationKey: string }) =>
      apiClient.post(`/runs/${runId}/gates/${stationKey}`, body),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.runs() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workOrders() }),
      ]),
  })
}
