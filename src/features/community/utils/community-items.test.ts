import { describe, expect, it } from 'vitest'

import { communityStandardKeySchema } from '@/lib/contracts'
import { COMMUNITY_LABELS, communitySummary } from './community-items'

describe('community-items', () => {
  it('labels every standard key', () => {
    for (const key of communityStandardKeySchema.options) {
      expect(COMMUNITY_LABELS[key]).toBeTruthy()
    }
  })

  it('summarizes how many standards are present', () => {
    expect(communitySummary([{ present: true }, { present: false }, { present: true }])).toBe(
      '2 of 3 complete',
    )
    expect(communitySummary([])).toBe('0 of 0 complete')
  })
})
