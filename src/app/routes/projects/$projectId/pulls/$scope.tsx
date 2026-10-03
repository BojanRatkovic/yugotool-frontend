import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { useProject } from '@/features/projects/components/project-nav'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { prScopeSchema } from '@/lib/contracts'

const searchSchema = z.object({
  /** Open pull request. The URL is the source of truth for the panel. */
  pr: z.coerce.number().int().positive().optional().catch(undefined),
  prTab: z
    .enum(['overview', 'files', 'threads', 'checks', 'commits'])
    .optional()
    .catch(undefined),
  /** Files tab: the file shown. */
  file: z.string().optional().catch(undefined),
  /** Threads tab (or a file's inline thread): the focused thread id. */
  thread: z.string().optional().catch(undefined),
  /** Files tab: only what changed since my last review. */
  since: z.literal('review').optional().catch(undefined),
  /** Pull request expanded to a full page instead of a side panel. */
  prFull: z.boolean().optional().catch(undefined),
  /** Assigned board: include team review requests. */
  teams: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/projects/$projectId/pulls/$scope')({
  validateSearch: searchSchema,
  beforeLoad: ({ params }) => {
    if (!prScopeSchema.safeParse(params.scope).success) {
      throw redirect({
        to: '/projects/$projectId/pulls/$scope',
        params: { projectId: params.projectId, scope: 'mine' },
      })
    }
  },
  loader: ({ context: { queryClient }, params }) => {
    const scope = prScopeSchema.catch('mine').parse(params.scope)
    void queryClient.prefetchQuery(prQueries.list(params.projectId, scope))
  },
  component: PullRequestsPage,
})

function PullRequestsPage() {
  const { projectId, scope: rawScope } = Route.useParams()
  const scope = prScopeSchema.catch('mine').parse(rawScope)
  const { teams } = Route.useSearch()
  const project = useProject(projectId)
  const list = useQuery(prQueries.list(projectId, scope, teams === true))
  return (
    <div className="flex h-svh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <h1 className="truncate text-sm font-semibold">{project?.name ?? 'Project'}</h1>
        <span className="text-sm text-muted-foreground">
          {scope === 'mine' ? 'My pull requests' : 'Assigned pull requests'}
        </span>
      </header>
      <p className="p-4 text-sm text-muted-foreground">
        {list.data === undefined ? 'Loading…' : `${list.data.items.length} pull requests`}
      </p>
    </div>
  )
}
