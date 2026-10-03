import type { AnyStatus } from '@/components/status/status'
import { REPO_HOOKS_STATION_KEY, type Station, type WorkOrder } from '@/lib/contracts'

/**
 * The line station a work order's `stationKey` points at. The repo-hooks
 * preflight isn't a line station: it runs just before the last gate, so the
 * order still sits at the station before that gate.
 */
export function lineStationKey(
  stationKey: string | null,
  stations: readonly Pick<Station, 'key' | 'kind'>[],
): string | null {
  if (stationKey !== REPO_HOOKS_STATION_KEY) return stationKey
  const gate = stations.findLastIndex((station) => station.kind === 'gate')
  const before = stations[(gate < 0 ? stations.length : gate) - 1] ?? stations[0]
  return before?.key ?? null
}

/**
 * One status per station, derived from where the work order sits on the line:
 * stations before the current one passed, the current one carries the order's
 * status, later ones are still queued. Cheap enough for every board card — no
 * run data needed.
 */
export function pipelineFor(
  workOrder: Pick<WorkOrder, 'status' | 'stationKey'>,
  stations: readonly Pick<Station, 'key' | 'kind'>[],
): AnyStatus[] {
  if (workOrder.status === 'done') return stations.map(() => 'succeeded')
  if (workOrder.status === 'backlog' || workOrder.status === 'queued')
    return stations.map(() => 'queued')
  const key = lineStationKey(workOrder.stationKey, stations)
  const current = stations.findIndex((station) => station.key === key)
  if (current < 0) return stations.map(() => 'queued')
  return stations.map((_, index) => {
    if (index < current) return 'succeeded'
    if (index > current) return 'queued'
    return workOrder.status
  })
}
