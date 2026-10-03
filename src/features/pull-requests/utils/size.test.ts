import { describe, expect, it } from 'vitest'

import { prSize, sizeLabel } from '@/features/pull-requests/utils/size'

describe('prSize', () => {
  it('buckets by lines changed', () => {
    expect(prSize(30, 19)).toBe('S')
    expect(prSize(40, 10)).toBe('M')
    expect(prSize(200, 49)).toBe('M')
    expect(prSize(200, 50)).toBe('L')
    expect(prSize(999, 0)).toBe('L')
    expect(prSize(1000, 0)).toBe('XL')
  })

  it('labels additions and deletions', () => {
    expect(sizeLabel(120, 8)).toBe('+120 −8')
  })
})
