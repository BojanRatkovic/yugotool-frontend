import { describe, expect, it } from 'vitest'

import { cycleIndex } from '@/components/image-lightbox'

describe('cycleIndex', () => {
  it('wraps both ways', () => {
    expect(cycleIndex(2, 1, 3)).toBe(0)
    expect(cycleIndex(0, -1, 3)).toBe(2)
    expect(cycleIndex(1, 1, 3)).toBe(2)
    expect(cycleIndex(0, 1, 0)).toBe(0)
  })
})
