import { useQuery } from '@tanstack/react-query'

import { remoteQueries } from '@/features/projects/api/remote-queries'
import { useProject } from '@/features/projects/components/project-nav'
import { PrNavItems } from '@/features/pull-requests/components/pr-nav-items'

/**
 * The project's pull request boards in the sidebar, only when it can have PRs
 * (GitHub + gh). Not for hub projects (spec 0014): their PRs are per repo, later.
 */
export function ProjectPrNav({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
  const hub = project?.kind === 'hub'
  const remote = useQuery({ ...remoteQueries.detail(projectId), enabled: !hub })
  if (hub || remote.data?.prPossible !== true) return null
  return <PrNavItems projectId={projectId} />
}
