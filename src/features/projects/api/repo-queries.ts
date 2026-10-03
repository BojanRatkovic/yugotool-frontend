import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiClient } from '@/lib/api-client'
import { repoSchema, type Repo } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'

async function getRepos(): Promise<Repo[]> {
  const data = await apiClient.get('/repos')
  return repoSchema.array().parse(data)
}

async function getBranches(path: string): Promise<string[]> {
  const data = await apiClient.get(`/repos/branches?path=${encodeURIComponent(path)}`)
  return z.array(z.string()).parse(data)
}

export const repoQueries = {
  list: () =>
    queryOptions({
      queryKey: queryKeys.repos(),
      queryFn: getRepos,
      // The backend walks the dev folder; don't rescan on every dialog open.
      staleTime: 60_000,
    }),
  branches: (path: string) =>
    queryOptions({
      queryKey: queryKeys.repoBranches(path),
      queryFn: () => getBranches(path),
      staleTime: 60_000,
    }),
}
