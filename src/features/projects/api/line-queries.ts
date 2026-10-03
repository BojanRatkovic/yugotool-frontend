import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { lineSchema, type Line, type LineKind, type UpdateLine } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

/** The build line keeps its original route; the review line (spec 0009) has its own. */
const linePath = (projectId: string, kind: LineKind) =>
  kind === 'review' ? `/projects/${projectId}/lines/review` : `/projects/${projectId}/line`

async function getLine(projectId: string, kind: LineKind = 'build'): Promise<Line> {
  const data = await apiClient.get(linePath(projectId, kind))
  return lineSchema.parse(data)
}

async function putLine(projectId: string, kind: LineKind, body: UpdateLine): Promise<Line> {
  const data = await apiClient.put(linePath(projectId, kind), body)
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
  /** Seeded from the template on the first read. */
  review: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.reviewLine(projectId),
      queryFn: () => getLine(projectId, 'review'),
      staleTime: 5 * 60_000,
    }),
}

export function useSaveLine(projectId: string, kind: LineKind = 'build') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateLine) => putLine(projectId, kind, body),
    onSuccess: (line) => {
      if (kind === 'review') {
        queryClient.setQueryData(lineQueries.review(projectId).queryKey, line)
        return undefined
      }
      queryClient.setQueryData(lineQueries.detail(projectId).queryKey, line)
      // Board columns are derived from the line.
      return queryClient.invalidateQueries({
        queryKey: queryKeys.workOrdersByProject(projectId),
      })
    },
  })
}
