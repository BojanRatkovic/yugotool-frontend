import { describe, expect, it } from 'vitest'

import { latestResearch, splitRoute, suggestedRepo } from '@/features/runs/utils/hub-plan'
import type { StationResearch } from '@/lib/contracts'

const sr = (research: StationResearch | null) => ({ research })
const run = (...stations: { research: StationResearch | null }[]) => ({ stations })
const split = [
  { title: 'API', description: '', repo: 'api' },
  { title: 'UI', description: '', repo: 'web' },
]

describe('hub plan gate (spec 0014)', () => {
  it('takes the latest research of the run', () => {
    expect(latestResearch(undefined)).toBeNull()
    expect(latestResearch(run(sr(null)))).toBeNull()
    expect(
      latestResearch(
        run(sr({ plan: 'a', repo: 'api' }), sr(null), sr({ plan: 'b', repo: 'web' })),
      ),
    ).toEqual({ plan: 'b', repo: 'web' })
  })

  it('starts on the preset repo, then the split head, then Research’s pick', () => {
    const repos = ['api', 'web']
    expect(suggestedRepo('web', { plan: '', repo: 'api' }, repos)).toBe('web')
    expect(suggestedRepo(null, { plan: '', repo: 'web', split }, repos)).toBe('api')
    expect(suggestedRepo(null, { plan: '', repo: 'web' }, repos)).toBe('web')
    expect(suggestedRepo(null, { plan: '', repo: null }, repos)).toBeNull()
    expect(suggestedRepo('gone', null, repos)).toBeNull()
  })

  it('summarises a split', () => {
    expect(splitRoute(split)).toBe('api → web')
  })
})
