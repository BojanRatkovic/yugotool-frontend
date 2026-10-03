import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { lineSchema, type Line, type UpdateLine } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getLine(projectId: string): Promise<Line> {
  const data = await apiClient.get(`/projects/${projectId}/line`)
  return lineSchema.parse(data)
}

async function putLine(projectId: string, body: UpdateLine): Promise<Line> {
  const data = await apiClient.put(`/projects/${projectId}/line`, body)
  return lineSchema.parse(data)
}

export const lineQueries = {
  detail: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.line(projectId),
      queryFn: () => getLine(projectId),
      // Only the line editor changes it, and that writes the cache directly.
      staleTime: 5 * 60_000,
    }),
}

export function useSaveLine(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateLine) => putLine(projectId, body),
    onSuccess: (line) => {
      queryClient.setQueryData(lineQueries.detail(projectId).queryKey, line)
      // Board columns are derived from the line.
      return queryClient.invalidateQueries({
        queryKey: queryKeys.workOrdersByProject(projectId),
      })
    },
  })
}
