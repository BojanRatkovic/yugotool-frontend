import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'

import { env } from '@/config/env'
import { ApiError, apiClient } from '@/lib/api-client'
import {
  previewDetectionSchema,
  previewSessionStatusSchema,
  previewStatusSchema,
  previewTestResultSchema,
  projectSchema,
  type FinishSignIn,
  type PreviewDetection,
  type PreviewSessionStatus,
  type PreviewStatus,
  type PreviewTestResult,
  type Project,
  type UpdateHubRepo,
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

async function patchHubRepo(
  projectId: string,
  repo: string,
  body: UpdateHubRepo,
): Promise<Project> {
  const data = await apiClient.patch(
    `/projects/${projectId}/repos/${encodeURIComponent(repo)}`,
    body,
  )
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

async function getPreviewSession(projectId: string): Promise<PreviewSessionStatus> {
  const data = await apiClient.get(`/projects/${projectId}/preview/session`)
  return previewSessionStatusSchema.parse(data)
}

async function startSignIn(projectId: string): Promise<PreviewSessionStatus> {
  const data = await apiClient.post(`/projects/${projectId}/preview/sign-in`)
  return previewSessionStatusSchema.parse(data)
}

async function finishSignIn(
  projectId: string,
  body: FinishSignIn,
): Promise<PreviewSessionStatus> {
  const data = await apiClient.post(`/projects/${projectId}/preview/sign-in/finish`, body)
  return previewSessionStatusSchema.parse(data)
}

async function forgetSession(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/preview/session`)
}

/** A sign-in is under way: the worker is booting the preview or the browser is open. */
export function isSignInActive(status: PreviewSessionStatus | undefined): boolean {
  const state = status?.signIn?.status
  return state === 'starting' || state === 'waiting'
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
  /** SSE `projects` refreshes it on every sign-in change; polled too while one is under way. */
  session: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.previewSession(projectId),
      queryFn: () => getPreviewSession(projectId),
      // The sign-in lives in the worker, outside the DB; a restored cache may be old. Cheap to re-read.
      staleTime: 0,
      refetchInterval: (query) => (isSignInActive(query.state.data) ? 2_000 : false),
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

/** A hub project's repo: its base branch and preview (spec 0014). */
export function useUpdateHubRepo(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ repo, ...body }: UpdateHubRepo & { repo: string }) =>
      patchHubRepo(projectId, repo, body),
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

/** Boots the preview and opens a visible browser on this Mac for the user to sign in. */
export function useStartSignIn(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => startSignIn(projectId),
    onSuccess: (status) => {
      queryClient.setQueryData(previewQueries.session(projectId).queryKey, status)
    },
  })
}

/** Done (save what the browser holds) or Cancel (discard it). */
export function useFinishSignIn(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: FinishSignIn) => finishSignIn(projectId, body),
    onSuccess: (status) => {
      queryClient.setQueryData(previewQueries.session(projectId).queryKey, status)
    },
  })
}

/** Deletes the saved session; previews and QA open the app signed out again. */
export function useForgetSession(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => forgetSession(projectId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: previewQueries.session(projectId).queryKey }),
  })
}
