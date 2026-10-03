import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import {
  type CreateKnowledgeSource,
  knowledgeSourceSchema,
  type KnowledgeSource,
  projectKnowledgeSchema,
  type ProjectKnowledge,
  type UpdateKnowledgeSource,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

const sourcesSchema = z.array(knowledgeSourceSchema)

export const knowledgeQueries = {
  sources: () =>
    queryOptions({
      queryKey: queryKeys.knowledgeSources(),
      queryFn: async () => sourcesSchema.parse(await apiClient.get('/knowledge-sources')),
    }),
  project: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.projectKnowledge(projectId),
      queryFn: async () =>
        projectKnowledgeSchema.parse(await apiClient.get(`/projects/${projectId}/knowledge`)),
    }),
}

function useInvalidateKnowledge() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.knowledge() })
}

/** Adds a source; the API syncs it once, so the result carries lastError when it can't be read. */
export function useCreateKnowledgeSource() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: async (body: CreateKnowledgeSource): Promise<KnowledgeSource> =>
      knowledgeSourceSchema.parse(await apiClient.post('/knowledge-sources', body)),
    onSuccess: invalidate,
  })
}

export function useUpdateKnowledgeSource() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: UpdateKnowledgeSource
    }): Promise<KnowledgeSource> =>
      knowledgeSourceSchema.parse(await apiClient.patch(`/knowledge-sources/${id}`, patch)),
    onSuccess: invalidate,
  })
}

/** 409 `knowledge_source_in_use` names the projects that still read it. */
export function useDeleteKnowledgeSource() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.delete(`/knowledge-sources/${id}`),
    onSuccess: invalidate,
  })
}

export function useSyncKnowledgeSource() {
  const invalidate = useInvalidateKnowledge()
  return useMutation({
    mutationFn: async ({ id }: { id: string }): Promise<KnowledgeSource> =>
      knowledgeSourceSchema.parse(await apiClient.post(`/knowledge-sources/${id}/sync`)),
    onSuccess: invalidate,
  })
}

export function useSetProjectKnowledge(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ProjectKnowledge): Promise<ProjectKnowledge> =>
      projectKnowledgeSchema.parse(
        await apiClient.put(`/projects/${projectId}/knowledge`, body),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(knowledgeQueries.project(projectId).queryKey, data)
      return queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeSources() })
    },
  })
}
