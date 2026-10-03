import { describe, expect, it } from 'vitest'

import { findingsLabel, fromBrief, zastavaState } from '@/features/pull-requests/utils/zastava'

describe('zastavaState', () => {
  it('counts the findings not posted yet', () => {
    const state = zastavaState({ status: 'succeeded', findings: 4, posted: 1, stale: false })
    expect(state).toEqual({ kind: 'done', findings: 4, open: 3, stale: false })
    if (state.kind === 'done') expect(findingsLabel(state)).toBe('3 findings')
  })

  it('says when everything is posted or there was nothing', () => {
    expect(findingsLabel({ kind: 'done', findings: 2, open: 0, stale: false })).toBe('2 posted')
    expect(findingsLabel({ kind: 'done', findings: 0, open: 0, stale: false })).toBe(
      'No findings',
    )
  })

  it('treats a cancelled review as none and a failed one as failed', () => {
    expect(
      zastavaState({ status: 'cancelled', findings: null, posted: 0, stale: false }),
    ).toEqual({ kind: 'none' })
    expect(
      zastavaState({ status: 'failed', findings: null, posted: 0, stale: false }).kind,
    ).toBe('failed')
  })

  it('marks a card stale when the head moved', () => {
    const brief = {
      number: 1,
      status: 'succeeded' as const,
      headOid: 'a',
      findings: 1,
      posted: 0,
    }
    expect(fromBrief(brief, 'b')).toMatchObject({ kind: 'done', stale: true })
    expect(fromBrief(undefined, 'b')).toEqual({ kind: 'none' })
  })
})
