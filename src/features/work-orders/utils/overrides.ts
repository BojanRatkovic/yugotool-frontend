import { z } from 'zod'

import { parseBudget } from '@/components/model-select'
import type { Effort } from '@/lib/contracts'

/** Form shape for the per-order overrides; the budget is edited as text. */
export interface OverrideValues {
  modelOverride: string | null
  effortOverride: Effort | null
  budget: string
}

/** Smallest cap a work order accepts (one cent). */
export const MIN_BUDGET_USD = 0.01

export const budgetFieldSchema = z.string().refine((raw) => {
  const value = parseBudget(raw)
  return value === null || (value !== undefined && value >= MIN_BUDGET_USD)
}, 'Enter at least $0.01, or leave empty for no cap.')

export function toOverrideValues(order: {
  modelOverride?: string | null
  effortOverride?: Effort | null
  maxBudgetUsd?: number | null
}): OverrideValues {
  return {
    modelOverride: order.modelOverride ?? null,
    effortOverride: order.effortOverride ?? null,
    budget: order.maxBudgetUsd == null ? '' : String(order.maxBudgetUsd),
  }
}

export function fromOverrideValues(values: OverrideValues) {
  return {
    modelOverride: values.modelOverride,
    effortOverride: values.effortOverride,
    maxBudgetUsd: parseBudget(values.budget) ?? null,
  }
}
