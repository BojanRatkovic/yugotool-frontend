import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import { routeMapStatusSchema, type RouteMapStatus, type UpdateRoutes } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getRoutes(projectId: string): Promise<RouteMapStatus> {
  const data = await apiClient.get(`/projects/${projectId}/routes`)
  return routeMapStatusSchema.parse(data)
}

async function discoverRoutes(projectId: string): Promise<RouteMapStatus> {
  const data = await apiClient.post(`/projects/${projectId}/routes/discover`)
  return routeMapStatusSchema.parse(data)
}

async function putRoutes(projectId: string, body: UpdateRoutes): Promise<RouteMapStatus> {
  const data = await apiClient.put(`/projects/${projectId}/routes`, body)
  return routeMapStatusSchema.parse(data)
}

/** Fallback poll while a discovery runs; SSE `projects` normally ends it sooner. */
const DISCOVERY_POLL_MS = 3_000

export const routesQueries = {
  status: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.projectRoutes(projectId),
      queryFn: () => getRoutes(projectId),
      staleTime: 30_000,
      refetchInterval: (query) => (query.state.data?.discovering ? DISCOVERY_POLL_MS : false),
    }),
}

/** Starts a route discovery session (Haiku, ~1 min). 409 `route_discovery_running` if one runs. */
export function useDiscoverRoutes(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => discoverRoutes(projectId),
    onSuccess: (status) => {
      queryClient.setQueryData(routesQueries.status(projectId).queryKey, status)
    },
  })
}

/** Replaces the route map with a human edit (sets editedByHuman). */
export function useUpdateRoutes(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateRoutes) => putRoutes(projectId, body),
    onSuccess: (status) => {
      queryClient.setQueryData(routesQueries.status(projectId).queryKey, status)
    },
  })
}
