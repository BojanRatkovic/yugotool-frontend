import { useMutation, useQueryClient } from '@tanstack/react-query'

import { projectsCollection } from '@/features/projects/api/projects-collection'
import { apiClient } from '@/lib/api-client'
import { queryKeys } from '@/lib/query-keys'

/**
 * Deletes a project (line, work orders, run history, its worktrees). 409
 * `project_has_active_work` while anything is queued, running or at a gate.
 * `onDeleted` runs first (navigate away), then the project leaves every cache,
 * including the persisted one, so nothing on screen refetches it.
 */
export function useDeleteProject({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (projectId: string) => {
      await apiClient.delete(`/projects/${projectId}`)
    },
    onSuccess: async (_data, projectId) => {
      await onDeleted()
      await projectsCollection.utils.writeDelete(projectId)
      // Line, preview, routes sit under ['projects', id]; the board under ['work-orders', id].
      queryClient.removeQueries({ queryKey: [...queryKeys.projects(), projectId] })
      queryClient.removeQueries({ queryKey: queryKeys.workOrdersByProject(projectId) })
      queryClient.removeQueries({ queryKey: queryKeys.projectStats(projectId) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.projects(), exact: true })
    },
  })
}
