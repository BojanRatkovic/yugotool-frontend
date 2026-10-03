import { describe, expect, it } from 'vitest'

import {
  budgetFieldSchema,
  fromOverrideValues,
  toOverrideValues,
} from '@/features/work-orders/utils/overrides'

describe('work order overrides', () => {
  it('round-trips through the form shape, with "" as no cap', () => {
    const values = toOverrideValues({
      modelOverride: null,
      effortOverride: 'high',
      maxBudgetUsd: 2.5,
    })
    expect(values).toEqual({ modelOverride: null, effortOverride: 'high', budget: '2.5' })
    expect(fromOverrideValues({ ...values, budget: '' }).maxBudgetUsd).toBeNull()
    expect(toOverrideValues({}).budget).toBe('')
  })

  it('accepts empty or positive budgets only', () => {
    expect(budgetFieldSchema.safeParse('').success).toBe(true)
    expect(budgetFieldSchema.safeParse('3').success).toBe(true)
    expect(budgetFieldSchema.safeParse('0').success).toBe(false)
    expect(budgetFieldSchema.safeParse('abc').success).toBe(false)
  })

  it('accepts cent-sized caps down to $0.01', () => {
    expect(budgetFieldSchema.safeParse('0.05').success).toBe(true)
    expect(budgetFieldSchema.safeParse('0.01').success).toBe(true)
    expect(budgetFieldSchema.safeParse('0.005').success).toBe(false)
  })
})
