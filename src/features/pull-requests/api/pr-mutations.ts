import { useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/lib/api-client'
import {
  type PostFindings,
  type PrLineCommentInput,
  type PrMergeMethod,
  type PrSubmitReviewInput,
  type PullRequestDetail,
  zastavaReviewSchema,
} from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

const base = (projectId: string, number: number) =>
  `/projects/${projectId}/pull-requests/${number}`

/** Every write changes the PR's panel and may move its card: refetch the project's PR data. */
function useInvalidatePr(projectId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.pullRequests(projectId) })
}

/** A comment in the PR conversation. */
export function useAddPrComment(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: ({ body }: { body: string }) =>
      apiClient.post(`${base(projectId, number)}/comments`, { body }),
    onSuccess: invalidate,
  })
}

/** Marks a file viewed (synced with GitHub); the checkbox flips at once and rolls back on failure. */
export function useSetFileViewed(projectId: string, number: number) {
  const queryClient = useQueryClient()
  const key = queryKeys.pullRequest(projectId, number)
  return useMutation({
    mutationFn: ({ path, viewed }: { path: string; viewed: boolean }) =>
      apiClient.put(`${base(projectId, number)}/files/viewed`, { path, viewed }),
    onMutate: async ({ path, viewed }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PullRequestDetail>(key)
      if (previous !== undefined) {
        queryClient.setQueryData<PullRequestDetail>(key, {
          ...previous,
          files: previous.files.map((f) => (f.path === path ? { ...f, viewed } : f)),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** A line comment into my pending review (GitHub creates the review when there is none). */
export function useAddLineComment(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: (input: PrLineCommentInput) =>
      apiClient.post(`${base(projectId, number)}/review/comments`, input),
    onSuccess: invalidate,
  })
}

/** Submits my pending review (or a new one) as approve / request changes / comment. */
export function useSubmitReview(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: (input: PrSubmitReviewInput) =>
      apiClient.post(`${base(projectId, number)}/review`, input),
    onSuccess: invalidate,
  })
}

/** "Comment now": the line comment goes into the pending review, which is submitted as COMMENT. */
export function useCommentNow(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: async (input: PrLineCommentInput) => {
      await apiClient.post(`${base(projectId, number)}/review/comments`, input)
      await apiClient.post(`${base(projectId, number)}/review`, { event: 'COMMENT', body: '' })
    },
    onSettled: invalidate,
  })
}

/** A reply in a review thread (posted right away, not into the pending review). */
export function useReplyToThread(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      apiClient.post(`${base(projectId, number)}/threads/${threadId}/replies`, { body }),
    onSuccess: invalidate,
  })
}

/** Resolve / unresolve: the thread flips at once and rolls back on failure. */
export function useResolveThread(projectId: string, number: number) {
  const queryClient = useQueryClient()
  const key = queryKeys.pullRequest(projectId, number)
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: ({ threadId, resolved }: { threadId: string; resolved: boolean }) =>
      apiClient.post(
        `${base(projectId, number)}/threads/${threadId}/${resolved ? 'resolve' : 'unresolve'}`,
      ),
    onMutate: async ({ threadId, resolved }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PullRequestDetail>(key)
      if (previous !== undefined) {
        queryClient.setQueryData<PullRequestDetail>(key, {
          ...previous,
          reviewThreads: previous.reviewThreads.map((t) =>
            t.id === threadId ? { ...t, isResolved: resolved } : t,
          ),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous)
    },
    onSettled: invalidate,
  })
}

/** Throws away my pending review and its comments. */
export function useDiscardReview(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: () => apiClient.delete(`${base(projectId, number)}/review`),
    onSuccess: invalidate,
  })
}

/** Draft → ready for review. */
export function useMarkReady(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: () => apiClient.post(`${base(projectId, number)}/ready`),
    onSuccess: invalidate,
  })
}

/** Merges with the method; GitHub's refusal comes back as a 409 with its reason. */
export function useMergePr(projectId: string, number: number) {
  const invalidate = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: ({ method }: { method: PrMergeMethod }) =>
      apiClient.post(`${base(projectId, number)}/merge`, { method }),
    onSuccess: invalidate,
  })
}

/** Every ZASTAVA review change also changes the cards' chips. */
function useInvalidateReviews() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.zastavaReviews() })
}

/** Starts a ZASTAVA review of the PR's current head (spec 0009). */
export function useStartZastavaReview(projectId: string, number: number) {
  const invalidate = useInvalidateReviews()
  return useMutation({
    mutationFn: async () =>
      zastavaReviewSchema.parse(
        await apiClient.post(`${base(projectId, number)}/zastava-review`, {
          id: crypto.randomUUID(),
        }),
      ),
    onSuccess: invalidate,
  })
}

/** The kept findings (as edited) into my pending review on GitHub; never submits. */
export function usePostZastavaFindings(projectId: string, number: number) {
  const invalidateReviews = useInvalidateReviews()
  const invalidatePr = useInvalidatePr(projectId)
  return useMutation({
    mutationFn: (input: PostFindings) =>
      apiClient.post(`${base(projectId, number)}/zastava-review/post`, input),
    // A refusal halfway still posted some: refresh either way.
    onSettled: () => Promise.all([invalidateReviews(), invalidatePr()]),
  })
}
