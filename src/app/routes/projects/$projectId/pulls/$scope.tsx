import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

import { useProject } from '@/features/projects/components/project-nav'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { PrBoard } from '@/features/pull-requests/components/pr-board'
import { PrBoardHeader } from '@/features/pull-requests/components/pr-board-header'
import { prScopeSchema } from '@/lib/contracts'
import { isTypingTarget } from '@/lib/shortcuts'

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

/** J/K walk the board's cards in reading order; Enter opens (native button). */
function moveCardFocus(step: 1 | -1) {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-pr-card]')]
  if (cards.length === 0) return
  const index = cards.findIndex((card) => card === document.activeElement)
  const next = index === -1 ? (step === 1 ? 0 : cards.length - 1) : index + step
  const card = cards[Math.max(0, Math.min(cards.length - 1, next))]
  card?.focus()
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function PullRequestsPage() {
  const { projectId, scope: rawScope } = Route.useParams()
  const scope = prScopeSchema.catch('mine').parse(rawScope)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const project = useProject(projectId)
  const teams = scope === 'assigned' && search.teams === true

  const openPr = (number: number | undefined) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        pr: number,
        prTab: undefined,
        file: undefined,
        thread: undefined,
        since: undefined,
        prFull: number === undefined ? undefined : prev.prFull,
      }),
    })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      if (search.pr === undefined && (event.key === 'j' || event.key === 'k')) {
        event.preventDefault()
        moveCardFocus(event.key === 'j' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="flex h-svh min-w-0 flex-col">
      <PrBoardHeader
        projectId={projectId}
        projectName={project?.name ?? 'Project'}
        scope={scope}
        teams={teams}
        onTeamsChange={(next) =>
          void navigate({ search: (prev) => ({ ...prev, teams: next ? true : undefined }) })
        }
      />
      <div className="min-h-0 flex-1 pt-3">
        <PrBoard
          projectId={projectId}
          scope={scope}
          teams={teams}
          onOpen={openPr}
          onEditDelivery={() =>
            void navigate({
              to: '/projects/$projectId',
              params: { projectId },
              search: { settings: 'delivery' },
            })
          }
        />
      </div>
    </div>
  )
}
