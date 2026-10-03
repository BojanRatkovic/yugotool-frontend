import { useQuery } from '@tanstack/react-query'

import { remoteQueries } from '@/features/projects/api/remote-queries'
import { PrNavItems } from '@/features/pull-requests/components/pr-nav-items'

/** The project's pull request boards in the sidebar, only when it can have PRs (GitHub + gh). */
export function ProjectPrNav({ projectId }: { projectId: string }) {
  const remote = useQuery(remoteQueries.detail(projectId))
  if (remote.data?.prPossible !== true) return null
  return <PrNavItems projectId={projectId} />
}
