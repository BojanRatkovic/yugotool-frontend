import type { DeliveryMode } from '@/lib/contracts'
import { isPrMode } from '@/lib/delivery'

/**
 * What the approve button does: the project default, or — when it's a PR mode
 * but PRs can't work (`prBlockedReason` set) — committing locally, flagged so
 * the banner can say why. Unknown remote (still loading) = no fallback.
 */
export function effectiveDelivery(
  projectDefault: DeliveryMode,
  prBlockedReason: string | null,
): { mode: DeliveryMode; fellBack: boolean } {
  if (prBlockedReason !== null && isPrMode(projectDefault))
    return { mode: 'local', fellBack: true }
  return { mode: projectDefault, fellBack: false }
}

/** The last gate is the one delivery follows; only it offers a delivery choice. */
export function isDeliveryGate(
  stations: readonly { key: string }[],
  stationKey: string,
): boolean {
  return stations.at(-1)?.key === stationKey
}

/** "Open pull request" fits work that was delivered without one: done, on a branch, no PR yet. */
export function canOpenPullRequest(workOrder: {
  status: string
  branch: string | null
  prUrl: string | null
}): boolean {
  return workOrder.status === 'done' && workOrder.branch !== null && workOrder.prUrl === null
}
