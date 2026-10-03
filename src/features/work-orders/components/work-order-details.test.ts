import { describe, expect, it } from 'vitest'

import { overridesEditable } from '@/features/work-orders/components/work-order-details'

describe('overridesEditable', () => {
  it('only while a next run can still happen', () => {
    for (const status of ['backlog', 'queued', 'failed', 'rejected', 'cancelled'] as const) {
      expect(overridesEditable(status)).toBe(true)
    }
    for (const status of ['running', 'awaiting_approval', 'done'] as const) {
      expect(overridesEditable(status)).toBe(false)
    }
  })
})
