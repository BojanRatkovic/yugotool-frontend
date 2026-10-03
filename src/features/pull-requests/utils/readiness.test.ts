import { describe, expect, it } from 'vitest'

import { readiness } from '@/features/pull-requests/utils/readiness'
import { OLD_OID, prActor, prDetail, prReviewer } from '@/testing/pull-request-fixtures'

const mine = (patch: Parameters<typeof prDetail>[0]) => readiness(prDetail(patch), 'me')
const theirs = (patch: Parameters<typeof prDetail>[0]) =>
  readiness(prDetail({ author: prActor('ana'), ...patch }), 'me')
const review = (state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED', commitOid?: string) => ({
  state,
  commitOid: commitOid ?? 'a'.repeat(40),
  submittedAt: new Date(Date.now() - 86_400_000).toISOString(),
})

describe('readiness verdict, my PR', () => {
  it('says what to do, in the board order', () => {
    expect(mine({ reviewDecision: 'APPROVED' }).verdict).toBe('Ready to merge.')
    expect(mine({ ci: 'failure', failingChecks: ['lint'] }).verdict).toBe(
      'Fix CI: lint failed.',
    )
    expect(mine({ threads: { unresolved: 2, waitingOnMe: 2 } }).verdict).toBe(
      '2 threads wait on you.',
    )
    expect(mine({ mergeable: 'CONFLICTING', baseRefName: 'master' }).verdict).toBe(
      'Resolve the merge conflict with master.',
    )
    expect(
      mine({
        reviewDecision: 'CHANGES_REQUESTED',
        reviewers: [prReviewer('ana', 'CHANGES_REQUESTED')],
      }).verdict,
    ).toBe('ana requested changes.')
    expect(mine({ reviewers: [prReviewer('ana', 'REQUESTED')] }).verdict).toBe(
      "Waiting on ana's review.",
    )
    expect(
      mine({ reviewers: [prReviewer('ana', 'REQUESTED'), prReviewer('marko', 'REQUESTED')] })
        .verdict,
    ).toBe('Waiting on reviews from ana and marko.')
    expect(mine({ isDraft: true }).verdict).toBe('Draft: mark it ready for review when it is.')
    expect(mine({}).verdict).toBe('Request a review.')
    expect(mine({ state: 'merged' }).verdict).toBe('Merged.')
  })
})

describe('readiness verdict, assigned PR', () => {
  it('puts my move first', () => {
    expect(theirs({ requestedFromMe: true }).verdict).toBe('Your review is next.')
    expect(theirs({ myLastReview: review('CHANGES_REQUESTED', OLD_OID) }).verdict).toBe(
      'Your review is next: new commits since you requested changes.',
    )
    expect(theirs({ myLastReview: review('CHANGES_REQUESTED') }).verdict).toBe(
      'Waiting on the author: you requested changes 1d ago.',
    )
    expect(
      theirs({
        myLastReview: review('APPROVED'),
        reviewers: [prReviewer('me', 'APPROVED'), prReviewer('marko', 'REQUESTED')],
      }).verdict,
    ).toBe("You approved. Waiting on marko's review.")
  })
})

describe('readiness chips', () => {
  it('counts reviews, relevant checks, threads and mergeability', () => {
    const r = mine({
      reviewDecision: 'REVIEW_REQUIRED',
      reviewers: [prReviewer('ana', 'APPROVED'), prReviewer('marko', 'REQUESTED')],
      ci: 'failure',
      checks: [
        { name: 'lint', state: 'fail', url: null, workflow: null },
        { name: 'test', state: 'pass', url: null, workflow: null },
        { name: 'deploy', state: 'skipping', url: null, workflow: null },
      ],
      threads: { unresolved: 2, waitingOnMe: 1 },
      mergeable: 'UNKNOWN',
    })
    expect(r.reviews).toEqual({ approved: 1, total: 2, state: 'wait' })
    expect(r.checks).toEqual({ passed: 1, total: 2, state: 'fail' })
    expect(r.threads).toEqual({ open: 2, waitingOnMe: 1, state: 'wait' })
    expect(r.mergeable).toBe('none')
  })
})
