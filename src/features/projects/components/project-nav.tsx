import { eq, useLiveQuery } from '@tanstack/react-db'
import { Link } from '@tanstack/react-router'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { NeedsYouPill } from '@/components/needs-you-pill'
import { StatusIcon } from '@/components/status/status-chip'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { projectsCollection } from '@/features/projects/api/projects-collection'
import { projectActivity } from '@/features/projects/utils/project-activity'
import { basename } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { useQueryError } from '@/lib/use-query-error'
import { cn } from '@/lib/utils'

/**
 * The row's leading dot. Idle: grey, brand on the active line — the one place
 * red marks "where you are". Running: the board's spinner. Only a gate
 * waiting: a violet dot matching the needs-you pill. The box keeps the dot's
 * 6px footprint so names never shift; the 10px spinner overflows it.
 */
function ActivityDot({ running, waiting }: { running: number; waiting: number }) {
  const { state, label } = projectActivity(running, waiting)
  const dot = (
    <span aria-hidden="true" className="flex size-1.5 shrink-0 items-center justify-center">
      {state === 'running' ? (
        <StatusIcon status="running" className="size-2.5 motion-reduce:animate-none" />
      ) : (
        <span
          className={cn(
            'size-1.5 rounded-full',
            state === 'waiting'
              ? 'bg-status-waiting'
              : 'bg-muted-foreground/40 group-data-[active=true]/project:bg-brand',
          )}
        />
      )}
    </span>
  )
  if (label === null) return dot
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{dot}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
      {/* The needs-you pill announces waiting work itself. */}
      {running > 0 ? <span className="sr-only">{running} running</span> : null}
    </>
  )
}

export function ProjectNav({
  needsYou,
  running,
  renderSub,
}: {
  /** Work orders waiting on a person, per project id. */
  needsYou?: ReadonlyMap<string, number>
  /** Work orders with a run in flight, per project id. */
  running?: ReadonlyMap<string, number>
  /** Items nested under each project (composed by the app, e.g. pull request boards). */
  renderSub?: (projectId: string) => React.ReactNode
} = {}) {
  const { data: projects, isLoading } = useLiveQuery((q) =>
    q.from({ project: projectsCollection }).orderBy(({ project }) => project.name, 'asc'),
  )
  const error = useQueryError(queryKeys.projects())

  if (isLoading && error === null) {
    return (
      <SidebarMenu>
        <SidebarMenuSkeleton />
        <SidebarMenuSkeleton />
      </SidebarMenu>
    )
  }

  if (projects.length === 0) {
    return (
      <p className="px-2 text-xs text-muted-foreground">
        {error === null ? 'No projects yet.' : 'Projects unavailable — is the API running?'}
      </p>
    )
  }

  return (
    <SidebarMenu>
      {projects.map((project) => (
        <SidebarMenuItem key={project.id}>
          {/* pr-8 on every row: branch badges line up whether or not a row has a chevron. */}
          <SidebarMenuButton
            asChild
            tooltip={project.repoPath}
            className="group/project h-8 pr-8"
          >
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              activeProps={{ 'data-active': true }}
            >
              <ActivityDot
                running={running?.get(project.id) ?? 0}
                waiting={needsYou?.get(project.id) ?? 0}
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <NeedsYouPill count={needsYou?.get(project.id) ?? 0} />
              <span className="max-w-24 truncate rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground">
                {project.kind === 'hub' ? 'hub' : project.baseBranch}
              </span>
            </Link>
          </SidebarMenuButton>
          {renderSub?.(project.id)}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

/** Live lookup of one project by id (for page headers). */
export function useProject(projectId: string) {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ project: projectsCollection })
        .where(({ project }) => eq(project.id, projectId))
        .findOne(),
    [projectId],
  )
  return data
}

/** Repo folder name, for display; the full path belongs in a tooltip. */
export function repoName(repoPath: string): string {
  return basename(repoPath)
}
