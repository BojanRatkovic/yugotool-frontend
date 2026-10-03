import { useLiveQuery } from '@tanstack/react-db'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Columns3, FolderGit2, Moon, Plus, Settings, Workflow } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { BranchChip } from '@/components/branch-chip'
import { StatusIcon } from '@/components/status/status-chip'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { projectsCollection } from '@/features/projects/api/projects-collection'
import { NewProjectDialog } from '@/app/routes/-components/new-project-dialog'
import { useWorkOrders } from '@/features/work-orders/api/use-work-order'
import { IS_MAC } from '@/lib/shortcuts'
import type { NeedsYouItem } from '@/app/routes/-components/use-needs-you'

function WorkOrderItems({
  projectId,
  onPick,
}: {
  projectId: string
  onPick: (id: string) => void
}) {
  const workOrders = useWorkOrders(projectId)
  if (workOrders.length === 0) return null
  return (
    <CommandGroup heading="Work orders">
      {workOrders
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((workOrder) => (
          <CommandItem
            key={workOrder.id}
            value={`wo ${workOrder.title} ${workOrder.id}`}
            onSelect={() => onPick(workOrder.id)}
          >
            <StatusIcon status={workOrder.status} />
            <span className="min-w-0 truncate">{workOrder.title}</span>
          </CommandItem>
        ))}
    </CommandGroup>
  )
}

/** ⌘K: jump to a project or work order, or run an action. Waiting work orders come first. */
export function CommandPalette({ needsYou = [] }: { needsYou?: readonly NeedsYouItem[] }) {
  const [open, setOpen] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const navigate = useNavigate()
  const { resolvedTheme, setTheme } = useTheme()
  const params = useParams({ strict: false })
  const projectId = 'projectId' in params ? params.projectId : undefined
  const { data: projects } = useLiveQuery((q) =>
    q.from({ project: projectsCollection }).orderBy(({ project }) => project.name, 'asc'),
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function run(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Jump to a project or work order, or run an action."
      >
        <Command>
          <CommandInput placeholder="Search projects, work orders, actions…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {needsYou.length === 0 ? null : (
              <CommandGroup heading="Needs you">
                {needsYou.map(({ workOrder, project, stationName }) => (
                  <CommandItem
                    key={workOrder.id}
                    value={`needs ${workOrder.title} ${project.name} ${workOrder.id}`}
                    onSelect={() =>
                      run(
                        () =>
                          void navigate({
                            to: '/projects/$projectId',
                            params: { projectId: project.id },
                            search: { view: 'board', wo: workOrder.id },
                          }),
                      )
                    }
                  >
                    <StatusIcon status="awaiting_approval" />
                    <span className="min-w-0 truncate">{workOrder.title}</span>
                    <span className="shrink-0 truncate text-xs text-muted-foreground">
                      {project.name}
                      {stationName === null ? null : ` · ${stationName}`}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {projectId === undefined ? null : (
              <CommandGroup heading="Actions">
                <CommandItem
                  onSelect={() =>
                    run(
                      () =>
                        void navigate({
                          to: '/projects/$projectId',
                          params: { projectId },
                          search: (prev) => ({ ...prev, new: true }),
                        }),
                    )
                  }
                >
                  <Plus aria-hidden="true" />
                  New work order
                  <CommandShortcut>C</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    run(
                      () =>
                        void navigate({
                          to: '/projects/$projectId',
                          params: { projectId },
                          search: { view: 'board' },
                        }),
                    )
                  }
                >
                  <Columns3 aria-hidden="true" />
                  Show board
                </CommandItem>
                <CommandItem
                  onSelect={() =>
                    run(
                      () =>
                        void navigate({
                          to: '/projects/$projectId',
                          params: { projectId },
                          search: { view: 'line' },
                        }),
                    )
                  }
                >
                  <Workflow aria-hidden="true" />
                  Edit line
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={projectId === undefined ? 'Actions' : undefined}>
              <CommandItem onSelect={() => run(() => setCreatingProject(true))}>
                <Plus aria-hidden="true" />
                New project
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light'))
                }
              >
                <Moon aria-hidden="true" />
                Toggle theme
              </CommandItem>
              <CommandItem onSelect={() => run(() => void navigate({ to: '/settings' }))}>
                <Settings aria-hidden="true" />
                Settings
                <CommandShortcut>{IS_MAC ? '⌘,' : 'Ctrl+,'}</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            {projectId === undefined ? null : (
              <WorkOrderItems
                projectId={projectId}
                onPick={(id) =>
                  run(
                    () =>
                      void navigate({
                        to: '/projects/$projectId',
                        params: { projectId },
                        search: (prev) => ({ ...prev, wo: id }),
                      }),
                  )
                }
              />
            )}
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`project ${project.name} ${project.repoPath}`}
                  onSelect={() =>
                    run(
                      () =>
                        void navigate({
                          to: '/projects/$projectId',
                          params: { projectId: project.id },
                        }),
                    )
                  }
                >
                  <FolderGit2 aria-hidden="true" />
                  <span className="min-w-0 truncate">{project.name}</span>
                  {/* No ml-auto: the item's hidden trailing check icon already takes it,
                      and two auto margins split the space unevenly per row. */}
                  <BranchChip branch={project.baseBranch} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      {creatingProject ? (
        <NewProjectDialog open={creatingProject} onOpenChange={setCreatingProject} />
      ) : null}
    </>
  )
}
