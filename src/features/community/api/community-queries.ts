import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { communityStandardsSchema, type CommunityStandards } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getStandards(projectId: string, repo?: string): Promise<CommunityStandards> {
  const query = repo === undefined ? '' : `?repo=${encodeURIComponent(repo)}`
  return communityStandardsSchema.parse(
    await apiClient.get(`/projects/${projectId}/community-standards${query}`),
  )
}

/**
 * GitHub's Community Standards for the project's repo (spec 0020). GitHub is the
 * source of truth and there are no webhooks, so it refetches on window focus and
 * stays fresh for a minute; community files change rarely.
 */
export const communityQueries = {
  standards: (projectId: string, repo?: string) =>
    queryOptions({
      queryKey: queryKeys.communityStandards(projectId, repo),
      queryFn: () => getStandards(projectId, repo),
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
}
