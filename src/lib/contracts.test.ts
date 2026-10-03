import { describe, expect, it } from 'vitest'

import { reviewPullRequestSchema, reviewVerdictSchema } from '@/lib/contracts'

describe('re-review contracts (spec 0010)', () => {
  it('fills the re-review fields on reviews from before 0010', () => {
    const pr = reviewPullRequestSchema.parse({
      number: 1,
      url: 'u',
      headRefName: 'h',
      headOid: 'a',
      baseRefName: 'main',
      baseOid: 'b',
      sinceOid: null,
    })
    expect(pr).toMatchObject({ postedThreads: {}, previousFindings: [] })
    const verdict = reviewVerdictSchema.parse({
      recommendation: 'approve',
      summary: '',
      findings: [],
    })
    expect(verdict.previous).toEqual([])
  })
})
