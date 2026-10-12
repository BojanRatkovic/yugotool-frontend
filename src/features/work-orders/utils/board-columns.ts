import { lineStationKey } from '@/features/work-orders/utils/pipeline'
import type { Station, WorkOrder } from '@/lib/contracts'

export const BACKLOG = '__backlog'
export const DONE = '__done'

/** Board column for a work order: backlog, its current station, or done. */
function columnFor(workOrder: WorkOrder, stationKeys: ReadonlySet<string>): string {
  if (workOrder.status === 'done') return DONE
  if (workOrder.stationKey !== null && stationKeys.has(workOrder.stationKey)) {
    return workOrder.stationKey
  }
  return BACKLOG
}

export interface BoardColumn {
  key: string
  title: string
  station: Station | null
  items: WorkOrder[]
}

export function buildColumns(stations: Station[], workOrders: WorkOrder[]): BoardColumn[] {
  const columns: BoardColumn[] = [
    { key: BACKLOG, title: 'Backlog', station: null, items: [] },
    ...stations.map((station) => ({
      key: station.key,
      title: station.name,
      station,
      items: [],
    })),
    { key: DONE, title: 'Done', station: null, items: [] },
  ]
  const byKey = new Map(columns.map((column) => [column.key, column]))
  const stationKeys = new Set(stations.map((station) => station.key))
  for (const workOrder of workOrders) {
    const stationKey = lineStationKey(workOrder.stationKey, stations)
    byKey.get(columnFor({ ...workOrder, stationKey }, stationKeys))?.items.push(workOrder)
  }
  for (const column of columns) column.items.sort((a, b) => a.position - b.position)
  return columns
}

/** Fractional position between two neighbours, so a move is a single PATCH. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return (after ?? 0) - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}
