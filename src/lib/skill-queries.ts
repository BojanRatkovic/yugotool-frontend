import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import { projectSkillSchema, type ProjectSkill } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getSkills(projectId: string): Promise<ProjectSkill[]> {
  const data = await apiClient.get(`/projects/${projectId}/skills`)
  return z.array(projectSkillSchema).parse(data)
}

/** Shared: the work order form, gate notes and station prompts all offer `/` skills. */
export const skillQueries = {
  /** Read from disk; skills change with a repo sync, so a few minutes is fresh enough. */
  list: (projectId: string) =>
    queryOptions({
      queryKey: queryKeys.projectSkills(projectId),
      queryFn: () => getSkills(projectId),
      staleTime: 5 * 60_000,
    }),
}
