import { queryOptions } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import {
  prDiffSchema,
  pullRequestDetailSchema,
  pullRequestListSchema,
  type PrDiff,
  type PrScope,
  type PullRequestDetail,
  type PullRequestList,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

const base = (projectId: string) => `/projects/${projectId}/pull-requests`

async function getList(
  projectId: string,
  scope: PrScope,
  teams: boolean,
): Promise<PullRequestList> {
  const query = new URLSearchParams({ scope, teams: String(teams) })
  return pullRequestListSchema.parse(await apiClient.get(`${base(projectId)}?${query}`))
}

async function getDetail(projectId: string, number: number): Promise<PullRequestDetail> {
  return pullRequestDetailSchema.parse(await apiClient.get(`${base(projectId)}/${number}`))
}

async function getDiff(
  projectId: string,
  number: number,
  since: string | null,
): Promise<PrDiff> {
  const query = since === null ? '' : `?since=${since}`
  return prDiffSchema.parse(await apiClient.get(`${base(projectId)}/${number}/diff${query}`))
}

/**
 * GitHub is the source of truth and there are no webhooks: lists poll every
 * minute and an open PR every 30 s, only while the window is focused.
 */
export const prQueries = {
  all: (projectId: string) => queryKeys.pullRequests(projectId),
  /** A board; also feeds the sidebar's needs-you pills (same key, so one request). */
  list: (projectId: string, scope: PrScope, teams = false) =>
    queryOptions({
      queryKey: queryKeys.pullRequestList(projectId, scope, teams),
      queryFn: () => getList(projectId, scope, teams),
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
  detail: (projectId: string, number: number) =>
    queryOptions({
      queryKey: queryKeys.pullRequest(projectId, number),
      queryFn: () => getDetail(projectId, number),
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      retry: 1,
    }),
  /** Keyed on the head: refetches only when someone pushes. */
  diff: (projectId: string, number: number, since: string | null, headOid: string) =>
    queryOptions({
      queryKey: queryKeys.pullRequestDiff(projectId, number, since, headOid),
      queryFn: () => getDiff(projectId, number, since),
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    }),
}
