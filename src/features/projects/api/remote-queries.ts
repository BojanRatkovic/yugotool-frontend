import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { projectRemoteSchema, type ProjectRemote } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getRemote(projectId: string, repo?: string): Promise<ProjectRemote> {
  const query = repo === undefined ? '' : `?repo=${encodeURIComponent(repo)}`
  const data = await apiClient.get(`/projects/${projectId}/remote${query}`)
  return projectRemoteSchema.parse(data)
}

export const remoteQueries = {
  /** Live git + gh check (~0.3s): fresh enough for a minute, rechecked on focus. */
  /** `repo`: where a hub project's repo can deliver (spec 0014). */
  detail: (projectId: string, repo?: string) =>
    queryOptions({
      queryKey: queryKeys.projectRemote(projectId, repo),
      queryFn: () => getRemote(projectId, repo),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
}
