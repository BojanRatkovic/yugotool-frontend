import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { useNow } from '@/hooks/use-now'
import type { PrScope } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** GitHub's own pulls page with the board's filter, for anything beyond it. */
function githubPullsUrl(repo: string, scope: PrScope): string {
  const filter =
    scope === 'mine' ? 'is:pr is:open author:@me' : 'is:pr is:open review-requested:@me'
  return `https://github.com/${repo}/pulls?q=${encodeURIComponent(filter)}`
}

function updatedAgo(fetchedAt: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(fetchedAt)) / 1000))
  if (seconds < 10) return 'Updated just now'
  if (seconds < 60) return `Updated ${seconds}s ago`
  return `Updated ${Math.floor(seconds / 60)} min ago`
}

/** Top bar of a PR board: project · My/Assigned · team requests · freshness · GitHub. */
export function PrBoardHeader({
  projectId,
  projectName,
  scope,
  teams,
  onTeamsChange,
}: {
  projectId: string
  projectName: string
  scope: PrScope
  teams: boolean
  onTeamsChange: (teams: boolean) => void
}) {
  const list = useQuery(prQueries.list(projectId, scope, teams))
  const now = useNow(10_000, list.data !== undefined)
  const teamsId = useId()
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <h1 className="truncate text-sm font-semibold">{projectName}</h1>
      <Tabs value={scope} className="ml-2">
        <TabsList className="h-7">
          <TabsTrigger value="mine" className="px-2.5 text-xs" asChild>
            <Link to="/projects/$projectId/pulls/$scope" params={{ projectId, scope: 'mine' }}>
              My
            </Link>
          </TabsTrigger>
          <TabsTrigger value="assigned" className="px-2.5 text-xs" asChild>
            <Link
              to="/projects/$projectId/pulls/$scope"
              params={{ projectId, scope: 'assigned' }}
              search={{ teams: teams ? true : undefined }}
            >
              Assigned
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {scope === 'assigned' ? (
        <div className="flex items-center gap-2">
          <Switch id={teamsId} size="sm" checked={teams} onCheckedChange={onTeamsChange} />
          <Label htmlFor={teamsId} className="text-xs font-normal text-muted-foreground">
            Include team requests
          </Label>
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {list.data === undefined ? null : (
          <span className="text-xs text-muted-foreground" aria-live="off">
            {updatedAgo(list.data.fetchedAt, now)}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh"
              disabled={list.isFetching}
              onClick={() => void list.refetch()}
            >
              <RefreshCw aria-hidden="true" className={cn(list.isFetching && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh from GitHub</TooltipContent>
        </Tooltip>
        {list.data === undefined ? null : (
          <Button variant="outline" size="sm" asChild>
            <a
              href={githubPullsUrl(list.data.repo, scope)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden="true" />
              Open on GitHub
            </a>
          </Button>
        )}
      </div>
    </header>
  )
}
