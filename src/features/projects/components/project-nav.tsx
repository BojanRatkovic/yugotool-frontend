import { eq, useLiveQuery } from '@tanstack/react-db'
import { Link } from '@tanstack/react-router'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { projectsCollection } from '@/features/projects/api/projects-collection'
import { basename } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { useQueryError } from '@/lib/use-query-error'

export function ProjectNav({
  needsYou,
}: {
  /** Work orders waiting on a person, per project id. */
  needsYou?: ReadonlyMap<string, number>
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
          <SidebarMenuButton asChild tooltip={project.repoPath} className="group/project h-8">
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              activeProps={{ 'data-active': true }}
            >
              {/* The active line gets the brand dot — the one place red marks "where you are". */}
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40 group-data-[active=true]/project:bg-brand"
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <NeedsYouPill count={needsYou?.get(project.id) ?? 0} />
              <span className="max-w-24 truncate rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground">
                {project.baseBranch}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

/** Violet count of work orders waiting on you; nothing when none. */
function NeedsYouPill({ count }: { count: number }) {
  if (count === 0) return null
  const label = `${count} need${count === 1 ? 's' : ''} you`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-status-waiting px-1 font-mono text-[0.625rem] font-semibold text-background tabular-nums">
          {count}
          <span className="sr-only"> {count === 1 ? 'needs' : 'need'} you</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
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
