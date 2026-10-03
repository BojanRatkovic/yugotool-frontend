import { useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

const base = (projectId: string, number: number) =>
  `/projects/${projectId}/pull-requests/${number}`

/** Every write changes the PR's panel and may move its card: refetch the project's PR data. */
function useInvalidatePr(projectId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests(projectId) })
}

/** A comment in the PR conversation. */
export function useAddPrComment(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: ({ body }: { body: string }) =>
      apiClient.post(`${base(projectId, number)}/comments`, { body }),
    onSuccess: invalidate,
  })
}
