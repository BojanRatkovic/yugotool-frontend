import { useLiveQuery } from '@tanstack/react-db'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { lineQueries } from '@/features/projects/api/line-queries'
import { projectsCollection } from '@/features/projects/api/projects-collection'
import { useWaitingWorkOrders } from '@/features/work-orders/api/waiting-work-orders'
import type { Project, WorkOrder } from '@/lib/contracts'

export interface NeedsYouItem {
  workOrder: WorkOrder
  project: Project
  /** The station it waits at ("Final review"); the key when the line no longer has it. */
  stationName: string | null
}

/**
 * Every work order waiting on a person, across projects, with its project and
 * the station it waits at. Composes the projects and work-orders features.
 */
export function useNeedsYou(): { items: NeedsYouItem[]; countByProject: Map<string, number> } {
  const { data: projects } = useLiveQuery((q) => q.from({ project: projectsCollection }))
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects])
  const waiting = useWaitingWorkOrders(projectIds)
  const waitingProjectIds = [...new Set(waiting.map((workOrder) => workOrder.projectId))]
  const lines = useQueries({
    queries: waitingProjectIds.map((projectId) => lineQueries.detail(projectId)),
  })

  const items = waiting.flatMap((workOrder) => {
    const project = projects.find((candidate) => candidate.id === workOrder.projectId)
    if (project === undefined) return []
    const line = lines[waitingProjectIds.indexOf(workOrder.projectId)]?.data
    const station = line?.stations.find((candidate) => candidate.key === workOrder.stationKey)
    return [{ workOrder, project, stationName: station?.name ?? workOrder.stationKey }]
  })
  items.sort((a, b) => a.workOrder.updatedAt.localeCompare(b.workOrder.updatedAt))
  const countByProject = new Map<string, number>()
  for (const { project } of items) {
    countByProject.set(project.id, (countByProject.get(project.id) ?? 0) + 1)
  }
  return { items, countByProject }
}

/** "(2) ZASTAVA" while anything waits on you, else "<project> · ZASTAVA". */
export function documentTitle(waiting: number, projectName: string | undefined): string {
  if (waiting > 0) return `(${waiting}) ZASTAVA`
  return projectName === undefined ? 'ZASTAVA' : `${projectName} · ZASTAVA`
}

export function useDocumentTitle(waiting: number, projectName: string | undefined) {
  useEffect(() => {
    document.title = documentTitle(waiting, projectName)
  }, [waiting, projectName])
}
