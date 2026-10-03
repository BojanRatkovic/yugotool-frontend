import type { PrReviewer, PullRequestDetail, PullRequestSummary } from '@/lib/contracts'

export const HEAD_OID = 'a'.repeat(40)
export const OLD_OID = 'b'.repeat(40)

export const prActor = (login: string) => ({ login, avatarUrl: '' })

export const prReviewer = (login: string, state: PrReviewer['state']): PrReviewer => ({
  actor: prActor(login),
  state,
})

/** An open, mergeable, CI-green PR by `me` with no reviewers; override what a test needs. */
export function prSummary(patch: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    number: 1,
    title: 'Change',
    url: 'https://github.com/acme/app/pull/1',
    state: 'open',
    isDraft: false,
    author: prActor('me'),
    headRefName: 'feature/1',
    baseRefName: 'main',
    headOid: HEAD_OID,
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    createdAt: '2026-10-03T09:00:00Z',
    updatedAt: '2026-10-03T11:00:00Z',
    mergedAt: null,
    reviewDecision: 'REVIEW_REQUIRED',
    mergeable: 'MERGEABLE',
    ci: 'success',
    failingChecks: [],
    reviewers: [],
    myLastReview: null,
    requestedFromMe: false,
    requestedFromMyTeam: false,
    assignedToMe: false,
    threads: { unresolved: 0, waitingOnMe: 0 },
    comments: 0,
    labels: [],
    ...patch,
  }
}

/** `prSummary` plus empty panel data. */
export function prDetail(patch: Partial<PullRequestDetail> = {}): PullRequestDetail {
  return {
    ...prSummary(),
    bodyHtml: '',
    viewerCanUpdate: true,
    viewerCanMerge: true,
    mergeMethods: ['merge', 'squash'],
    pendingReview: null,
    checks: [],
    files: [],
    reviewThreads: [],
    timeline: [],
    commits: [],
    truncated: { files: false, threads: false, timeline: false, commits: false },
    ...patch,
  }
}
