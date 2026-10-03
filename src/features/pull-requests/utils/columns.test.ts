import { describe, expect, it } from 'vitest'

import {
  buildPrColumns,
  needsYouCount,
  placePr,
  shortAge,
} from '@/features/pull-requests/utils/columns'
import type { PrReviewer, PullRequestSummary } from '@/lib/contracts'

const NOW = Date.parse('2026-10-03T12:00:00Z')
const HEAD = 'a'.repeat(40)
const OLD = 'b'.repeat(40)

const actor = (login: string) => ({ login, avatarUrl: '' })
const reviewer = (login: string, state: PrReviewer['state']): PrReviewer => ({
  actor: actor(login),
  state,
})

function pr(patch: Partial<PullRequestSummary> = {}): PullRequestSummary {
  return {
    number: 1,
    title: 'Change',
    url: 'https://github.com/acme/app/pull/1',
    state: 'open',
    isDraft: false,
    author: actor('me'),
    headRefName: 'feature/1',
    baseRefName: 'main',
    headOid: HEAD,
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

const mine = (patch: Partial<PullRequestSummary>) => placePr(pr(patch), 'mine', NOW)
const assigned = (patch: Partial<PullRequestSummary>) =>
  placePr(pr({ author: actor('ana'), ...patch }), 'assigned', NOW)
const myReview = (
  state: NonNullable<PullRequestSummary['myLastReview']>['state'],
  commitOid = HEAD,
) => ({ state, commitOid, submittedAt: '2026-10-02T12:00:00Z' })

describe('placePr: my pull requests', () => {
  it('puts merged and closed PRs in Done', () => {
    expect(mine({ state: 'merged', mergedAt: '2026-10-01T12:00:00Z' })).toEqual({
      column: 'done',
      reason: 'Merged 2d ago',
      tone: 'muted',
    })
    expect(mine({ state: 'closed' }).reason).toBe('Closed')
  })

  it('puts drafts in Draft, before anything else, with the CI cause', () => {
    expect(mine({ isDraft: true })).toMatchObject({ column: 'draft', reason: 'Draft' })
    expect(
      mine({ isDraft: true, ci: 'failure', reviewDecision: 'CHANGES_REQUESTED' }),
    ).toMatchObject({ column: 'draft', reason: 'Draft · CI failing', tone: 'failed' })
  })

  it('puts each "needs work" cause in Needs work, changes requested first', () => {
    expect(
      mine({
        reviewDecision: 'CHANGES_REQUESTED',
        reviewers: [reviewer('ana', 'CHANGES_REQUESTED')],
        ci: 'failure',
      }),
    ).toMatchObject({
      column: 'needs_work',
      reason: 'Changes requested by ana',
      tone: 'waiting',
    })
    expect(mine({ ci: 'failure', failingChecks: ['lint', 'test'] })).toMatchObject({
      column: 'needs_work',
      reason: 'CI failed: lint, test',
      tone: 'failed',
    })
    expect(mine({ threads: { unresolved: 3, waitingOnMe: 2 } })).toMatchObject({
      column: 'needs_work',
      reason: '2 threads wait on you',
    })
    expect(mine({ mergeable: 'CONFLICTING' })).toMatchObject({
      column: 'needs_work',
      reason: 'Merge conflict',
    })
  })

  it('never treats an unknown mergeable state as a conflict', () => {
    expect(mine({ mergeable: 'UNKNOWN', reviewDecision: 'APPROVED' }).column).toBe('ready')
  })

  it('is Ready to merge when approved, CI green or absent and no conflict', () => {
    expect(
      mine({ reviewDecision: 'APPROVED', reviewers: [reviewer('ana', 'APPROVED')] }),
    ).toMatchObject({ column: 'ready', reason: 'Approved by ana · CI green' })
    expect(
      mine({ reviewDecision: null, reviewers: [reviewer('ana', 'APPROVED')], ci: 'none' }),
    ).toMatchObject({ column: 'ready', reason: 'Approved by ana · no CI' })
  })

  it('keeps an approved PR with CI running in review', () => {
    expect(mine({ reviewDecision: 'APPROVED', ci: 'pending' })).toMatchObject({
      column: 'in_review',
      reason: 'Approved · CI running',
    })
  })

  it('says whom an in-review PR waits on', () => {
    expect(
      mine({ reviewers: [reviewer('ana', 'REQUESTED'), reviewer('marko', 'REQUESTED')] })
        .reason,
    ).toBe('Waiting on ana, marko')
    expect(mine({ reviewers: [{ team: 'team-a', state: 'REQUESTED' }] }).reason).toBe(
      'Waiting on team-a',
    )
    expect(mine({}).reason).toBe('No reviewer yet')
    expect(mine({ ci: 'pending' }).reason).toBe('No reviewer yet · CI running')
  })
})

describe('placePr: assigned pull requests', () => {
  it('puts merged and closed PRs in Done', () => {
    expect(assigned({ state: 'merged', mergedAt: '2026-10-02T12:00:00Z' })).toMatchObject({
      column: 'done',
      reason: 'Merged 1d ago',
    })
  })

  it('puts PRs I never reviewed in To review', () => {
    expect(assigned({ requestedFromMe: true })).toMatchObject({
      column: 'to_review',
      reason: 'Requested · opened 3h ago',
      tone: 'waiting',
    })
    expect(assigned({ requestedFromMyTeam: true }).reason).toBe('Team request · opened 3h ago')
    expect(assigned({ assignedToMe: true }).reason).toBe('Assigned')
    // A never-reviewed draft still needs a first look.
    expect(assigned({ isDraft: true, requestedFromMe: true }).column).toBe('to_review')
  })

  it('puts re-requests, answered change requests and dismissals in Re-review', () => {
    expect(
      assigned({ requestedFromMe: true, myLastReview: myReview('APPROVED', OLD) }),
    ).toMatchObject({
      column: 're_review',
      reason: 'Re-requested · new commits since your review',
    })
    expect(assigned({ myLastReview: myReview('CHANGES_REQUESTED', OLD) })).toMatchObject({
      column: 're_review',
      reason: 'New commits since you requested changes',
    })
    expect(assigned({ myLastReview: myReview('DISMISSED') })).toMatchObject({
      column: 're_review',
      reason: 'Your review was dismissed',
    })
  })

  it('puts my change requests and comments without new commits, and drafts, in Waiting on author', () => {
    expect(assigned({ myLastReview: myReview('CHANGES_REQUESTED') })).toMatchObject({
      column: 'waiting_author',
      reason: 'You requested changes 1d ago',
      tone: 'muted',
    })
    expect(assigned({ myLastReview: myReview('COMMENTED') }).reason).toBe(
      'You commented 1d ago',
    )
    expect(assigned({ myLastReview: myReview('COMMENTED'), isDraft: true }).reason).toBe(
      'Draft · you commented',
    )
  })

  it('puts standing approvals in Approved', () => {
    expect(
      assigned({
        myLastReview: myReview('APPROVED'),
        reviewers: [reviewer('me', 'APPROVED'), reviewer('marko', 'REQUESTED')],
      }),
    ).toMatchObject({ column: 'approved', reason: 'You approved · waiting on 1 more' })
    expect(assigned({ myLastReview: myReview('APPROVED', OLD) }).reason).toBe(
      'You approved · new commits since',
    )
  })
})

describe('buildPrColumns', () => {
  it('orders threads waiting on me first, then newest', () => {
    const columns = buildPrColumns(
      [
        pr({ number: 1, updatedAt: '2026-10-03T10:00:00Z' }),
        pr({ number: 2, updatedAt: '2026-10-03T11:00:00Z' }),
        pr({
          number: 3,
          updatedAt: '2026-10-01T10:00:00Z',
          ci: 'pending',
          threads: { unresolved: 1, waitingOnMe: 1 },
          reviewDecision: 'CHANGES_REQUESTED',
        }),
      ],
      'mine',
      NOW,
    )
    expect(columns.map((c) => c.key)).toEqual([
      'draft',
      'needs_work',
      'ready',
      'in_review',
      'done',
    ])
    expect(columns.find((c) => c.key === 'in_review')?.items.map((i) => i.pr.number)).toEqual([
      2, 1,
    ])
    expect(columns.find((c) => c.key === 'needs_work')?.items.map((i) => i.pr.number)).toEqual([
      3,
    ])
  })
})

describe('needsYouCount', () => {
  it('counts Needs work for mine and To review + Re-review for assigned', () => {
    expect(needsYouCount([pr({ ci: 'failure' }), pr({})], 'mine', NOW)).toBe(1)
    expect(
      needsYouCount(
        [
          pr({ author: actor('ana'), requestedFromMe: true }),
          pr({ author: actor('ana'), myLastReview: myReview('DISMISSED') }),
          pr({ author: actor('ana'), myLastReview: myReview('APPROVED') }),
        ],
        'assigned',
        NOW,
      ),
    ).toBe(2)
  })
})

describe('shortAge', () => {
  it('is compact', () => {
    expect(shortAge('2026-10-03T11:59:40Z', NOW)).toBe('now')
    expect(shortAge('2026-10-03T11:48:00Z', NOW)).toBe('12m')
    expect(shortAge('2026-10-03T09:00:00Z', NOW)).toBe('3h')
    expect(shortAge('2026-10-01T12:00:00Z', NOW)).toBe('2d')
    expect(shortAge('2026-09-01T12:00:00Z', NOW)).toBe('4w')
  })
})
