import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { apiClient } from '@/lib/api-client'
import { projectSchema, type CreateProject, type Project } from '@/lib/contracts'
import { queryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

async function getProjects(): Promise<Project[]> {
  const data = await apiClient.get('/projects')
  return projectSchema.array().parse(data)
}

/** All projects. Inserts are optimistic; the client-generated id makes them idempotent. */
export const projectsCollection = createCollection(
  queryCollectionOptions({
    queryKey: queryKeys.projects(),
    queryFn: getProjects,
    queryClient,
    getKey: (project) => project.id,
    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(({ modified }) => {
          const body: CreateProject = {
            id: modified.id,
            name: modified.name,
            repoPath: modified.repoPath,
            baseBranch: modified.baseBranch,
          }
          return apiClient.post('/projects', body)
        }),
      )
    },
  }),
)
