import type { WorkOrder } from '@/lib/contracts'

/** A hub project's board (spec 0014): its repos and every work order's title, for chips. */
export interface BoardHub {
  repos: string[]
  titles: ReadonlyMap<string, string>
}

export function boardHub(
  repos: string[] | undefined,
  workOrders: Pick<WorkOrder, 'id' | 'title'>[],
): BoardHub | null {
  if (repos === undefined) return null
  return { repos, titles: new Map(workOrders.map((w) => [w.id, w.title])) }
}

/** The repo chip: the chosen repo, or "Auto" while Research still picks. */
export function repoChipLabel(workOrder: Pick<WorkOrder, 'repo'>): string {
  return workOrder.repo ?? 'Auto'
}

/** "after <title>" for a split's follower; null otherwise. */
export function followsLabel(
  workOrder: Pick<WorkOrder, 'followsId'>,
  titles: ReadonlyMap<string, string>,
): string | null {
  if (workOrder.followsId === null) return null
  return `after ${titles.get(workOrder.followsId) ?? 'another work order'}`
}
