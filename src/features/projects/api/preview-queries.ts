import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { env } from '@/config/env'
import { ApiError, apiClient } from '@/lib/api-client'
import {
  previewDetectionSchema,
  previewStatusSchema,
  previewTestResultSchema,
  projectSchema,
  type PreviewDetection,
  type PreviewStatus,
  type PreviewTestResult,
  type Project,
  type UpdateProject,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getPreviewStatus(projectId: string): Promise<PreviewStatus> {
  const data = await apiClient.get(`/projects/${projectId}/preview/test`)
  return previewStatusSchema.parse(data)
}

async function patchProject(projectId: string, body: UpdateProject): Promise<Project> {
  const data = await apiClient.patch(`/projects/${projectId}`, body)
  return projectSchema.parse(data)
}

async function testPreview(projectId: string): Promise<PreviewTestResult> {
  const data = await apiClient.post(`/projects/${projectId}/preview/test`)
  return previewTestResultSchema.parse(data)
}

async function detectPreview(projectId: string): Promise<PreviewDetection> {
  const data = await apiClient.post(`/projects/${projectId}/preview/detect`)
  return previewDetectionSchema.parse(data)
}

/** The API answers with its own path (`/projects/:id/preview/screenshot?t=…`). */
export function apiAssetUrl(path: string): string {
  return `${env.API_URL}${path}`
}

export const previewQueries = {
  status: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.previewStatus(projectId),
      queryFn: () => getPreviewStatus(projectId),
      staleTime: 30_000,
    }),
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateProject) => patchProject(projectId, body),
    // The projects collection is backed by this key; the preview status sits under it too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects() }),
  })
}

/** Boots the preview once on the base branch. Slow: up to the ready timeout. */
export function useTestPreview(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => testPreview(projectId),
    onSuccess: (last) => {
      queryClient.setQueryData(previewQueries.status(projectId).queryKey, { last })
    },
  })
}

/**
 * Proposes a preview from the repo's files (package.json, lockfile, .nvmrc).
 * Saves nothing. Retries a 404 briefly: right after "Create project" the
 * optimistic insert may not have reached the API yet.
 */
export function useDetectPreview(projectId: string) {
  return useMutation({
    mutationFn: () => detectPreview(projectId),
    retry: (failures, error) =>
      error instanceof ApiError && error.status === 404 && failures < 4,
    retryDelay: 400,
  })
}
