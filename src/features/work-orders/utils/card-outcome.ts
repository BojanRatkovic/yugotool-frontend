import { lineStationKey } from '@/features/work-orders/utils/pipeline'
import { REPO_HOOKS_STATION_KEY, type Station, type WorkOrder } from '@/lib/contracts'

const STOPPED_WORD = { failed: 'Failed', cancelled: 'Cancelled', rejected: 'Rejected' } as const

/** `review_gate` → `Review gate`: a readable name for a station key the line no longer has. */
function stationKeyLabel(key: string): string | null {
  const words = key.split('_').filter((word) => word !== '')
  if (words.length === 0) return null
  const text = words.join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Chip word for an order that stopped on the line, naming where:
 * "Failed at QA", "Cancelled at Build", "Rejected at Final review". A failure
 * at a gate can only be the delivery after its approval → "Delivery failed".
 * Null for orders that didn't stop.
 */
export function stoppedLabel(
  workOrder: Pick<WorkOrder, 'status' | 'stationKey'>,
  stations: readonly Pick<Station, 'key' | 'kind' | 'name'>[],
): string | null {
  const { status } = workOrder
  if (status !== 'failed' && status !== 'cancelled' && status !== 'rejected') return null
  // The preflight sits before the last gate but isn't a line station.
  if (workOrder.stationKey === REPO_HOOKS_STATION_KEY)
    return `${STOPPED_WORD[status]} at repo hooks`
  const key = lineStationKey(workOrder.stationKey, stations)
  const station = stations.find((candidate) => candidate.key === key)
  if (station === undefined) {
    // The line no longer has that station; its key is all that's left of it.
    const name = workOrder.stationKey === null ? null : stationKeyLabel(workOrder.stationKey)
    return name === null ? STOPPED_WORD[status] : `${STOPPED_WORD[status]} at ${name}`
  }
  if (status === 'failed' && station.kind === 'gate') return 'Delivery failed'
  return `${STOPPED_WORD[status]} at ${station.name}`
}
