import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { projectRemoteSchema, type ProjectRemote } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getRemote(projectId: string): Promise<ProjectRemote> {
  const data = await apiClient.get(`/projects/${projectId}/remote`)
  return projectRemoteSchema.parse(data)
}

export const remoteQueries = {
  /** Live git + gh check (~0.3s): fresh enough for a minute, rechecked on focus. */
  detail: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.projectRemote(projectId),
      queryFn: () => getRemote(projectId),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
}
