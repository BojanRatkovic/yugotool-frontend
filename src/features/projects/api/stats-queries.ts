import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { projectStatsSchema, type ProjectStats } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getProjectStats(projectId: string): Promise<ProjectStats> {
  const data = await apiClient.get(`/projects/${projectId}/stats`)
  return projectStatsSchema.parse(data)
}

export const statsQueries = {
  project: (projectId: string) =>
    queryOptions({
      // Keyed under `runs`, so SSE runs invalidations refresh it.
      queryKey: queryKeys.projectStats(projectId),
      queryFn: () => getProjectStats(projectId),
    }),
}
