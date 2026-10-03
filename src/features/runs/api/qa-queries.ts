import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { qaRunSchema, type QaRun } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getQaRuns(runId: string): Promise<QaRun[]> {
  const data = await apiClient.get(`/runs/${runId}/qa`)
  return qaRunSchema
    .array()
    .parse(data)
    .map((qaRun) => ({
      ...qaRun,
      checks: qaRun.checks.toSorted((a, b) => a.position - b.position),
    }))
    .toSorted((a, b) => a.attempt - b.attempt)
}

export const qaQueries = {
  /** QA attempts (with checks) for a run. SSE `qa` invalidates the root. */
  list: (runId: string) =>
    queryOptions({
      queryKey: queryKeys.runQa(runId),
      queryFn: () => getQaRuns(runId),
    }),
}

/** "Accept as intended": the API answers 202 with an empty body. */
export function useAcceptQaCheck(runId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checkId: string) =>
      apiClient.post(`/runs/${runId}/qa/checks/${checkId}/accept`),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.qa() }),
        // The station run's QA counts (stepper, gate banner) come with the runs.
        queryClient.invalidateQueries({ queryKey: queryKeys.runs() }),
      ]),
  })
}
