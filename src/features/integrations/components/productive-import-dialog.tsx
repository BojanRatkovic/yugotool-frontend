import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  ChevronsUpDown,
  ExternalLink,
  LoaderCircle,
  ListPlus,
  Search,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ProductiveMark } from '@/components/productive-mark'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  productiveQueries,
  useImportProductiveTasks,
  type ProductiveTaskFilter,
} from '@/features/integrations/api/productive-queries'
import {
  rememberedProductiveProject,
  rememberProductiveProject,
} from '@/features/integrations/utils/productive'
import { errorMessage } from '@/lib/api-client'
import type { ProductiveProject, ProductiveTask } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const SEARCH_ID = 'productive-task-search'

/** Typing settles before the search hits Productive. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * Import from Productive (spec 0019): pick open tasks, add them to this
 * project's backlog. Tasks already on the board show "In backlog".
 */
export function ProductiveImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Open on the search field (the first thing you do here), not the first button.
        onOpenAutoFocus={(event) => {
          const search = document.getElementById(SEARCH_ID)
          if (search === null) return
          event.preventDefault()
          search.focus()
        }}
        className="flex max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 p-0 sm:max-h-[min(85dvh,52rem)] sm:max-w-3xl"
      >
        {/* Remounts on open: a fresh selection and filters every time. */}
        {open ? <ImportBody projectId={projectId} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ImportBody({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const status = useQuery(productiveQueries.status())
  const [productiveProjectId, setProductiveProjectId] = useState(() =>
    rememberedProductiveProject(projectId),
  )
  const [query, setQuery] = useState('')
  const [mine, setMine] = useState(true)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const debouncedQuery = useDebounced(query, 300)
  const filter: ProductiveTaskFilter = {
    projectId,
    productiveProjectId,
    query: debouncedQuery,
    mine,
  }
  const connected = status.data?.connection != null
  const tasks = useInfiniteQuery({ ...productiveQueries.tasks(filter), enabled: connected })
  const items = tasks.data?.pages.flatMap((page) => page.items) ?? []
  const importTasks = useImportProductiveTasks()

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function submit() {
    // Keep the order the list shows, so the backlog reads the same way.
    const taskIds = items.filter((task) => selected.has(task.id)).map((task) => task.id)
    importTasks.mutate(
      { projectId, taskIds },
      {
        onSuccess: (created) => {
          toast.success(
            created.length === 1
              ? 'Added 1 work order to the backlog.'
              : `Added ${created.length} work orders to the backlog.`,
          )
          onDone()
        },
        onError: (error) => toast.error(`Couldn't import: ${errorMessage(error)}`),
      },
    )
  }

  const pickable = items.filter((task) => task.workOrderId === null)
  const allPicked = pickable.length > 0 && pickable.every((task) => selected.has(task.id))

  return (
    <>
      <DialogHeader className="gap-1 border-b p-4">
        <DialogTitle className="flex items-center gap-2">
          <ProductiveMark />
          Import from Productive
        </DialogTitle>
        <DialogDescription>
          Each task becomes a work order in Backlog with its title, description and a link back.
        </DialogDescription>
      </DialogHeader>

      {status.isPending ? (
        <div className="p-4">
          <Skeleton className="h-9 w-full" />
        </div>
      ) : !connected ? (
        <NotConnected onDone={onDone} />
      ) : (
        <>
          <TaskFilters
            productiveProjectId={productiveProjectId}
            onProductiveProject={(id) => {
              setProductiveProjectId(id)
              rememberProductiveProject(projectId, id)
            }}
            query={query}
            onQuery={setQuery}
            mine={mine}
            onMine={setMine}
          />

          <SelectAllBar
            allPicked={allPicked}
            canPick={pickable.length > 0}
            onToggleAll={() =>
              setSelected(allPicked ? new Set() : new Set(pickable.map((task) => task.id)))
            }
            label={
              tasks.isPending
                ? 'Loading open tasks…'
                : `${items.length}${tasks.hasNextPage ? '+' : ''} open task${items.length === 1 ? '' : 's'}`
            }
            refreshing={tasks.isFetching && !tasks.isPending}
          />

          <div
            className="min-h-40 flex-1 scrollbar-thin overflow-y-auto"
            aria-busy={tasks.isPending}
          >
            <TaskListBody
              loading={tasks.isPending}
              error={tasks.error}
              items={items}
              mine={mine}
              selected={selected}
              onToggle={toggle}
            />
            {tasks.hasNextPage ? (
              <div className="flex justify-center p-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={tasks.isFetchingNextPage}
                  onClick={() => void tasks.fetchNextPage()}
                >
                  {tasks.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <ImportFooter
        count={selected.size}
        pending={importTasks.isPending}
        onCancel={onDone}
        onSubmit={submit}
      />
    </>
  )
}

function SelectAllBar({
  allPicked,
  canPick,
  onToggleAll,
  label,
  refreshing,
}: {
  allPicked: boolean
  canPick: boolean
  onToggleAll: () => void
  label: string
  refreshing: boolean
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        aria-label="Select every task shown"
        className="size-4 accent-foreground"
        checked={allPicked}
        disabled={!canPick}
        onChange={onToggleAll}
      />
      <span className="mr-auto">{label}</span>
      {refreshing ? (
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
      ) : null}
    </div>
  )
}

function ImportFooter({
  count,
  pending,
  onCancel,
  onSubmit,
}: {
  count: number
  pending: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <DialogFooter className="m-0 flex-row items-center gap-2 border-t p-3 sm:justify-end">
      <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
        {count === 0 ? 'Nothing selected' : `${count} selected`}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" size="sm" disabled={count === 0 || pending} onClick={onSubmit}>
        {pending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <ListPlus aria-hidden="true" />
        )}
        {count > 1 ? `Add ${count} to backlog` : 'Add to backlog'}
      </Button>
    </DialogFooter>
  )
}

function NotConnected({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 p-4 text-[0.8125rem]">
      <p className="text-muted-foreground">
        Productive isn&rsquo;t connected yet. Add your API token first.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link to="/settings/integrations" onClick={onDone}>
          Open Settings → Integrations
        </Link>
      </Button>
    </div>
  )
}

/** Productive project, title search and "Assigned to me". */
function TaskFilters({
  productiveProjectId,
  onProductiveProject,
  query,
  onQuery,
  mine,
  onMine,
}: {
  productiveProjectId: string | null
  onProductiveProject: (id: string | null) => void
  query: string
  onQuery: (query: string) => void
  mine: boolean
  onMine: (mine: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
      <ProjectPicker value={productiveProjectId} onChange={onProductiveProject} />
      <InputGroup className="h-8 sm:flex-1">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search tasks"
          id={SEARCH_ID}
          placeholder="Search titles"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </InputGroup>
      <div className="flex items-center gap-2 sm:pl-1">
        <Switch id="productive-mine" checked={mine} onCheckedChange={onMine} />
        <Label htmlFor="productive-mine" className="text-[0.8125rem] font-normal">
          Assigned to me
        </Label>
      </div>
    </div>
  )
}

/** The task rows, or a skeleton, the load error, or the empty note. */
function TaskListBody({
  loading,
  error,
  items,
  mine,
  selected,
  onToggle,
}: {
  loading: boolean
  error: Error | null
  items: ProductiveTask[]
  mine: boolean
  selected: ReadonlySet<string>
  onToggle: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-12 w-full" />
        ))}
      </div>
    )
  }
  if (error !== null && items.length === 0) {
    return (
      <p className="p-4 text-[0.8125rem] text-destructive">
        Couldn&rsquo;t load tasks: {errorMessage(error)}
      </p>
    )
  }
  if (items.length === 0) {
    return (
      <p className="p-4 text-[0.8125rem] text-muted-foreground">
        No open tasks match.
        {mine ? ' Turn off "Assigned to me" to see everyone’s.' : null}
      </p>
    )
  }
  return (
    <ul className="divide-y">
      {items.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          checked={selected.has(task.id)}
          onToggle={() => onToggle(task.id)}
        />
      ))}
    </ul>
  )
}

function TaskRow({
  task,
  checked,
  onToggle,
}: {
  task: ProductiveTask
  checked: boolean
  onToggle: () => void
}) {
  const imported = task.workOrderId !== null
  const id = `productive-task-${task.id}`
  const meta = [task.projectName, task.status, task.assigneeName].filter(Boolean).join(' · ')
  return (
    <li
      className={cn(
        'flex items-start gap-3 px-4 py-2.5',
        checked && 'bg-accent/60',
        imported && 'opacity-60',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-foreground"
        checked={imported || checked}
        disabled={imported}
        onChange={onToggle}
      />
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5">
        <span className="flex items-baseline gap-2 text-[0.8125rem]">
          {task.number === null ? null : (
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              #{task.number.replace(/^#/, '')}
            </span>
          )}
          <span className="line-clamp-2 font-medium">{task.title}</span>
        </span>
        {meta === '' ? null : (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        )}
      </label>
      {imported ? (
        <span className="mt-0.5 shrink-0 rounded-sm border px-1.5 text-[0.6875rem] text-muted-foreground">
          In backlog
        </span>
      ) : null}
      <a
        href={task.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open "${task.title}" in Productive`}
        className="mt-0.5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
      >
        <ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </li>
  )
}

/** Searchable Productive project select; "All projects" clears it. */
function ProjectPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const projects = useQuery(productiveQueries.projects())
  const current = projects.data?.find((project) => project.id === value)
  const label =
    value === null
      ? 'All projects'
      : (current?.name ?? (projects.isPending ? 'Loading…' : 'Project'))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Productive project"
          className="h-8 w-full justify-between font-normal sm:w-56"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown aria-hidden="true" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find a project" />
          {/* The popover is portaled outside the dialog, whose scroll lock eats wheel
              and touch scrolling; stopping them here lets the list scroll. */}
          <CommandList
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>
              {projects.isPending
                ? 'Loading projects…'
                : projects.error !== null
                  ? `Couldn't load projects: ${errorMessage(projects.error)}`
                  : 'No project matches.'}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All projects"
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <Check
                  aria-hidden="true"
                  className={cn(value === null ? 'opacity-100' : 'opacity-0')}
                />
                All projects
              </CommandItem>
              {(projects.data ?? []).map((project: ProductiveProject) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name} ${project.number ?? ''} ${project.id}`}
                  onSelect={() => {
                    onChange(project.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={cn(value === project.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="truncate">{project.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
