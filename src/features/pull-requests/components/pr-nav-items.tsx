import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ChevronRight, GitPullRequest, GitPullRequestArrow } from 'lucide-react'
import { useState } from 'react'

import { NeedsYouPill } from '@/components/needs-you-pill'
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { needsYouCount } from '@/features/pull-requests/utils/columns'
import { isPrNavOpen, savePrNavOpen } from '@/features/pull-requests/utils/pr-nav-open'
import type { PrScope } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const ITEMS: { scope: PrScope; label: string; Icon: typeof GitPullRequest }[] = [
  { scope: 'mine', label: 'My pull requests', Icon: GitPullRequest },
  { scope: 'assigned', label: 'Assigned pull requests', Icon: GitPullRequestArrow },
]

function usePrNeedsYou(projectId: string, scope: PrScope): number {
  // Same query (and cache entry) as the board without team requests; the
  // sidebar alone polls every 5 min (GitHub's API budget), an open board every minute.
  const { data } = useQuery({
    ...prQueries.list(projectId, scope),
    refetchInterval: 5 * 60_000,
  })
  return data === undefined ? 0 : needsYouCount(data.items, scope)
}

/**
 * "My / Assigned pull requests" under a project, each with its needs-you
 * count, behind a chevron on the project row. Collapsed by default; opening a
 * board expands its project. Collapsed, a violet dot on the chevron says a
 * pull request needs you, so hiding the list never hides the work.
 */
export function PrNavItems({ projectId }: { projectId: string }) {
  const counts: Record<PrScope, number> = {
    mine: usePrNeedsYou(projectId, 'mine'),
    assigned: usePrNeedsYou(projectId, 'assigned'),
  }
  const waiting = counts.mine + counts.assigned
  const params = useParams({ strict: false })
  const onBoard = 'scope' in params && params.projectId === projectId
  const [open, setOpen] = useState(() => onBoard || isPrNavOpen(projectId))
  const toggle = (next: boolean) => {
    setOpen(next)
    savePrNavOpen(projectId, next)
  }
  // Arriving on one of its boards (a link, the palette) expands the project,
  // so the active board is always visible in the sidebar.
  const [wasOnBoard, setWasOnBoard] = useState(onBoard)
  if (onBoard !== wasOnBoard) {
    setWasOnBoard(onBoard)
    if (onBoard) setOpen(true)
  }

  const listId = `pr-nav-${projectId}`
  const flagged = !open && waiting > 0
  return (
    <>
      <SidebarMenuAction
        showOnHover
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={
          open
            ? 'Hide pull requests'
            : `Show pull requests${waiting > 0 ? ` (${waiting} need${waiting === 1 ? 's' : ''} you)` : ''}`
        }
        onClick={() => toggle(!open)}
        className={cn('text-muted-foreground', flagged && 'md:opacity-100')}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'transition-transform motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
        {flagged ? (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-status-waiting"
          />
        ) : null}
      </SidebarMenuAction>
      {open ? (
        <SidebarMenuSub id={listId}>
          {ITEMS.map((item) => (
            <PrNavItem
              key={item.scope}
              projectId={projectId}
              count={counts[item.scope]}
              {...item}
            />
          ))}
        </SidebarMenuSub>
      ) : null}
    </>
  )
}

function PrNavItem({
  projectId,
  scope,
  label,
  Icon,
  count,
}: {
  projectId: string
  scope: PrScope
  label: string
  Icon: typeof GitPullRequest
  count: number
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild size="sm" className="h-7">
        <Link
          to="/projects/$projectId/pulls/$scope"
          params={{ projectId, scope }}
          activeProps={{ 'data-active': true }}
        >
          <Icon aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <NeedsYouPill count={count} />
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}
