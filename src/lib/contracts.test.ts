import { describe, expect, it } from 'vitest'

import {
  gateDecisionSchema,
  projectSchema,
  researchPlanSchema,
  reviewPullRequestSchema,
  reviewVerdictSchema,
} from '@/lib/contracts'

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

describe('hub project contracts (spec 0014)', () => {
  it('parses a hub project with its repos and a gate repo override', () => {
    const project = projectSchema.parse({
      id: '0199d0a4-0000-7000-8000-000000000001',
      kind: 'hub',
      name: 'shop-work',
      repoPath: '/w/shop-work',
      baseBranch: 'main',
      preview: null,
      deliveryDefault: 'local',
      hubPath: '/w/shop-work',
      repos: [
        { name: 'api', path: '/w/shop-work/repos/api', baseBranch: 'develop', preview: null },
      ],
      createdAt: '2026-10-10T12:00:00.000Z',
      updatedAt: '2026-10-10T12:00:00.000Z',
    })
    expect(project.repos[0]?.name).toBe('api')
    expect(gateDecisionSchema.parse({ decision: 'approve', repo: 'web' }).repo).toBe('web')
  })

  it('parses a research plan with a split', () => {
    const plan = researchPlanSchema.parse({
      plan: 'p',
      repo: 'api',
      split: [
        { title: 'a', description: '', repo: 'api' },
        { title: 'b', description: '', repo: 'web' },
      ],
    })
    expect(plan.split).toHaveLength(2)
  })
})
