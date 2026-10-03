import type { DeliveryMode } from '@/lib/contracts'

/**
 * Delivery wording shared by the gate's approve menu and project settings, so
 * both name the three outcomes the same way.
 */
export const DELIVERY_OPTIONS: Record<
  DeliveryMode,
  { approveLabel: string; menuLabel: string; hint: string; outcome: string }
> = {
  local: {
    approveLabel: 'Approve & commit locally',
    menuLabel: 'Commit locally',
    hint: 'Commit on the work order’s branch. Nothing is pushed.',
    outcome: 'committing locally',
  },
  draft_pr: {
    approveLabel: 'Approve & open draft PR',
    menuLabel: 'Open draft PR',
    hint: 'Push the branch and open a draft pull request.',
    outcome: 'opening a draft PR',
  },
  pr: {
    approveLabel: 'Approve & open PR',
    menuLabel: 'Open PR',
    hint: 'Push the branch and open a pull request ready for review.',
    outcome: 'opening a PR',
  },
}

export const DELIVERY_MODES: readonly DeliveryMode[] = ['local', 'draft_pr', 'pr']

/** Draft and ready PRs need a pushable GitHub origin and a logged-in gh. */
export function isPrMode(mode: DeliveryMode): boolean {
  return mode !== 'local'
}
