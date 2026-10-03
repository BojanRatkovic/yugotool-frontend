import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { GitPullRequest, GitPullRequestArrow } from 'lucide-react'

import { NeedsYouPill } from '@/components/needs-you-pill'
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { needsYouCount } from '@/features/pull-requests/utils/columns'
import type { PrScope } from '@/lib/contracts'

const ITEMS: { scope: PrScope; label: string; Icon: typeof GitPullRequest }[] = [
  { scope: 'mine', label: 'My pull requests', Icon: GitPullRequest },
  { scope: 'assigned', label: 'Assigned pull requests', Icon: GitPullRequestArrow },
]

/** "My / Assigned pull requests" under a project, each with its needs-you count. */
export function PrNavItems({ projectId }: { projectId: string }) {
  return (
    <SidebarMenuSub>
      {ITEMS.map((item) => (
        <PrNavItem key={item.scope} projectId={projectId} {...item} />
      ))}
    </SidebarMenuSub>
  )
}

function PrNavItem({
  projectId,
  scope,
  label,
  Icon,
}: {
  projectId: string
  scope: PrScope
  label: string
  Icon: typeof GitPullRequest
}) {
  // Same query (and cache entry) as the board without team requests; the
  // sidebar alone polls every 5 min (GitHub's API budget), an open board every minute.
  const { data } = useQuery({
    ...prQueries.list(projectId, scope),
    refetchInterval: 5 * 60_000,
  })
  const count = data === undefined ? 0 : needsYouCount(data.items, scope)
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
