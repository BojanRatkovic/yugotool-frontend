import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import {
  productiveConnectionSchema,
  productiveProjectSchema,
  productiveStatusSchema,
  productiveTaskPageSchema,
  workOrderSchema,
  type ConnectProductive,
  type ImportProductiveTasks,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

export interface ProductiveTaskFilter {
  /** The YugoTool project importing; marks tasks it already has. */
  projectId: string
  productiveProjectId: string | null
  query: string
  mine: boolean
}

function taskSearch(filter: ProductiveTaskFilter, page: number): string {
  const params = new URLSearchParams({
    projectId: filter.projectId,
    mine: String(filter.mine),
    page: String(page),
  })
  if (filter.productiveProjectId !== null)
    params.set('productiveProjectId', filter.productiveProjectId)
  if (filter.query.trim() !== '') params.set('query', filter.query.trim())
  return params.toString()
}

export const productiveQueries = {
  status: () =>
    queryOptions({
      queryKey: queryKeys.productive(),
      queryFn: async () =>
        productiveStatusSchema.parse(await apiClient.get('/integrations/productive')),
      staleTime: 60_000,
      retry: 1,
    }),
  /** Active Productive projects; read live, so cached a while. */
  projects: (query = '') =>
    queryOptions({
      queryKey: queryKeys.productiveProjects(query),
      queryFn: async () =>
        z
          .array(productiveProjectSchema)
          .parse(
            await apiClient.get(
              `/integrations/productive/projects${query ? `?${new URLSearchParams({ query })}` : ''}`,
            ),
          ),
      staleTime: 5 * 60_000,
      retry: 1,
    }),
  /** Open tasks, newest activity first, 50 a page. */
  tasks: (filter: ProductiveTaskFilter) =>
    infiniteQueryOptions({
      queryKey: queryKeys.productiveTasks(filter),
      queryFn: async ({ pageParam }) =>
        productiveTaskPageSchema.parse(
          await apiClient.get(
            `/integrations/productive/tasks?${taskSearch(filter, pageParam)}`,
          ),
        ),
      initialPageParam: 1,
      getNextPageParam: (last) => last.nextPage ?? undefined,
      staleTime: 30_000,
      retry: 1,
    }),
}

/** Connect with a token, or switch organization (no token: the saved one). */
export function useConnectProductive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConnectProductive) =>
      productiveConnectionSchema.parse(await apiClient.put('/integrations/productive', body)),
    // A new organization means new projects and tasks: drop them all.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.integrations() }),
  })
}

export function useDisconnectProductive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete('/integrations/productive'),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: [...queryKeys.productive(), 'tasks'] })
      queryClient.removeQueries({ queryKey: [...queryKeys.productive(), 'projects'] })
      return queryClient.invalidateQueries({ queryKey: queryKeys.productive() })
    },
  })
}

/** Tasks into a project's backlog. The board refreshes from the work orders it returns. */
export function useImportProductiveTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ImportProductiveTasks) =>
      z
        .array(workOrderSchema)
        .parse(await apiClient.post('/integrations/productive/import', body)),
    onSuccess: (_created, body) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.workOrdersByProject(body.projectId),
        }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.productive(), 'tasks'] }),
      ]),
  })
}
