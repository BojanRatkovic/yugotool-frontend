import { describe, expect, it } from 'vitest'

import { checksSummary } from '@/features/pull-requests/components/pr-checks-tab'
import type { PrCheck } from '@/lib/contracts'

const check = (state: PrCheck['state']): PrCheck => ({
  name: state,
  state,
  url: null,
  workflow: null,
})

describe('checksSummary', () => {
  it('counts passed of the checks that ran, then the rest', () => {
    expect(
      checksSummary([
        check('pass'),
        check('pass'),
        check('fail'),
        check('pending'),
        check('skipping'),
      ]),
    ).toBe('2/4 passed · 1 failed · 1 running · 1 skipped')
    expect(checksSummary([check('pass')])).toBe('1/1 passed')
  })
})
