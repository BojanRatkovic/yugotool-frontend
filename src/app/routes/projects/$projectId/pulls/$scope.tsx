import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useProject } from '@/features/projects/components/project-nav'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { PrBoard } from '@/features/pull-requests/components/pr-board'
import { PrBoardHeader } from '@/features/pull-requests/components/pr-board-header'
import { PrPanel, type PrPanelState } from '@/features/pull-requests/components/pr-panel'
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
  /** Files tab: "review" = only what changed since my last review, "all" = the whole PR. */
  since: z.enum(['review', 'all']).optional().catch(undefined),
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
  const list = useQuery(prQueries.list(projectId, scope, teams))
  const { pr } = search
  const full = pr !== undefined && search.prFull === true

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
      if (pr === undefined && (event.key === 'j' || event.key === 'k')) {
        event.preventDefault()
        moveCardFocus(event.key === 'j' ? 1 : -1)
      } else if (event.key === 'Escape' && full) {
        event.preventDefault()
        openPr(undefined)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const panelState: PrPanelState = {
    tab: search.prTab ?? 'overview',
    file: search.file,
    thread: search.thread,
    since: search.since,
    full,
  }
  const panel =
    pr === undefined || list.data === undefined ? null : (
      <PrPanel
        key={pr}
        projectId={projectId}
        number={pr}
        viewer={list.data.viewer}
        state={panelState}
        onChange={(next) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              ...('tab' in next
                ? { prTab: next.tab === 'overview' ? undefined : next.tab }
                : {}),
              ...('file' in next ? { file: next.file } : {}),
              ...('thread' in next ? { thread: next.thread } : {}),
              ...('since' in next ? { since: next.since } : {}),
              ...('full' in next ? { prFull: next.full === true ? true : undefined } : {}),
            }),
          })
        }
        onClose={() => openPr(undefined)}
      />
    )

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
        {full ? (
          panel
        ) : (
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
        )}
      </div>

      <Sheet
        open={pr !== undefined && !full}
        onOpenChange={(open) => (open ? null : openPr(undefined))}
      >
        <SheetContent
          // The PR panel's shortcuts work inside its own sheet (see isPanelTypingTarget).
          data-pr-sheet
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
          }}
          className="gap-0 p-0 focus-visible:outline-none data-[side=right]:w-[min(1120px,78vw)] data-[side=right]:sm:max-w-none"
        >
          <SheetTitle className="sr-only">Pull request</SheetTitle>
          <SheetDescription className="sr-only">
            Description, conversation, files, threads, checks and commits of the selected pull
            request.
          </SheetDescription>
          {full ? null : panel}
        </SheetContent>
      </Sheet>
    </div>
  )
}
