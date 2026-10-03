import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  FileCode2,
  LoaderCircle,
  Map as MapIcon,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { LoadError } from '@/components/data-state'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  routesQueries,
  useDiscoverRoutes,
  useUpdateRoutes,
} from '@/features/projects/api/routes-queries'
import {
  EMPTY_ROUTE,
  parseRouteValues,
  toRouteValues,
  upsertRoute,
  type RouteField,
} from '@/features/projects/utils/route-form'
import { useNow } from '@/hooks/use-now'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { RouteDiscovery, RouteEntry, RouteMapStatus } from '@/lib/contracts'
import { formatDuration, formatRelative, formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

const EXPLAINER =
  'QA’s planner uses this map to find which screens a change touches. Discovery reads your router and mock data (~1 min, Haiku).'

const fieldId = (field: RouteField) => `route-${field}`

/** Which row the edit dialog is open on: an index, a new row, or closed. */
type Editing = { index: number | null } | null

/** The project's route map: discovery status, the list, per-row edits (PUT). */
export function RoutesSettings({ projectId }: { projectId: string }) {
  const status = useQuery(routesQueries.status(projectId))
  const discover = useDiscoverRoutes(projectId)
  const update = useUpdateRoutes(projectId)
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState<Editing>(null)

  const data = status.data
  const map = data?.map ?? null
  const routes = map?.routes ?? []
  const discovering = data?.discovering === true || discover.isPending

  function startDiscovery() {
    setConfirming(false)
    discover.mutate(undefined, {
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'route_discovery_running') {
          toast.info('A discovery is already running.')
          void status.refetch()
          return
        }
        toast.error(`Couldn't start discovery: ${errorMessage(error)}`)
      },
    })
  }

  function save(next: RouteEntry[], done: string, onSuccess?: () => void) {
    update.mutate(
      { routes: next },
      {
        onSuccess: () => {
          onSuccess?.()
          toast.success(done)
        },
        onError: (error) => toast.error(`Couldn't save the routes: ${errorMessage(error)}`),
      },
    )
  }

  function remove(index: number) {
    const previous = routes
    const removed = routes[index]
    if (removed === undefined) return
    update.mutate(
      { routes: routes.filter((_, i) => i !== index) },
      {
        onSuccess: () =>
          toast.success(`Removed “${removed.title}”.`, {
            action: {
              label: 'Undo',
              onClick: () => update.mutate({ routes: previous }),
            },
          }),
        onError: (error) => toast.error(`Couldn't remove the route: ${errorMessage(error)}`),
      },
    )
  }

  const editingRoute =
    editing === null || editing.index === null ? undefined : routes[editing.index]

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <section aria-labelledby="routes-heading" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="routes-heading" className="text-sm font-semibold">
              Routes
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              The app&rsquo;s screens. QA&rsquo;s planner maps each diff onto them.
            </p>
          </div>
          {map === null ? null : (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={discovering || update.isPending}
                onClick={() => setEditing({ index: null })}
              >
                <Plus aria-hidden="true" />
                Add route
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={discovering}
                onClick={() => (map.editedByHuman ? setConfirming(true) : startDiscovery())}
              >
                {discovering ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <RefreshCw aria-hidden="true" />
                )}
                Rediscover
              </Button>
            </div>
          )}
        </div>

        {status.isPending ? (
          <div className="flex flex-col gap-1" aria-busy="true">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-36 w-full" />
          </div>
        ) : data === undefined ? (
          <LoadError what="the route map" message={status.error?.message ?? 'Unknown error.'} />
        ) : (
          <>
            <StatusLine status={data} discovering={discovering} since={discover.submittedAt} />
            {map === null ? (
              <EmptyState discovering={discovering} onDiscover={startDiscovery} />
            ) : (
              <RouteList
                routes={routes}
                disabled={update.isPending}
                onEdit={(index) => setEditing({ index })}
                onRemove={remove}
              />
            )}
          </>
        )}
      </section>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace your edits?</DialogTitle>
            <DialogDescription>
              You edited this map. Rediscovering replaces it with a fresh one from the router,
              and your changes are lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
              Keep my edits
            </Button>
            <Button size="sm" onClick={startDiscovery}>
              <RefreshCw aria-hidden="true" />
              Rediscover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent className="sm:max-w-lg">
          {editing === null ? null : (
            <RouteDialogBody
              key={editing.index ?? 'new'}
              route={editingRoute}
              pending={update.isPending}
              onCancel={() => setEditing(null)}
              onSave={(route) =>
                save(
                  upsertRoute(routes, editing.index, route),
                  editing.index === null ? `Added “${route.title}”.` : 'Route saved.',
                  () => setEditing(null),
                )
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusLine({
  status,
  discovering,
  since,
}: {
  status: RouteMapStatus
  discovering: boolean
  since: number
}) {
  const now = useNow(1000, discovering)
  const { map, stale, lastDiscovery } = status
  const failed = lastDiscovery !== null && !lastDiscovery.ok
  // Started from this tab: count up. Otherwise (another tab, a reload) just say it's running.
  const seconds = Math.round((now - since) / 1000)
  const elapsed = since > 0 && seconds >= 0 && seconds < 600 ? seconds : null

  return (
    <div className="flex flex-col gap-1">
      <p className="flex h-5 min-w-0 items-center gap-2 text-[0.8125rem] whitespace-nowrap text-muted-foreground">
        {map === null ? (
          <span>No route map yet</span>
        ) : (
          <>
            <span className="tabular-nums">
              {map.routes.length === 1 ? '1 route' : `${map.routes.length} routes`}
            </span>
            <span aria-hidden="true">·</span>
            <span title={new Date(map.generatedAt).toLocaleString()}>
              generated {formatRelative(map.generatedAt, now)}
            </span>
            {map.editedByHuman ? <Pill>Edited by you</Pill> : null}
            {stale ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals why
                    tabIndex={0}
                  >
                    <Pill className="bg-status-waiting-soft text-status-waiting">
                      Router changed
                    </Pill>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  The router or mock files changed on the base branch since this map was made.
                  {map.editedByHuman ? ' Rediscover to refresh it.' : ''}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </>
        )}
      </p>
      {/* Always one line tall: discovery progress, the last result, or nothing — no jump. */}
      <p
        aria-live="polite"
        className="flex h-5 min-w-0 items-center gap-1.5 text-[0.8125rem] whitespace-nowrap"
      >
        {discovering ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin text-status-running"
            />
            <span className="text-status-running">Discovering routes…</span>
            {elapsed === null ? null : (
              <span className="min-w-7 font-mono text-xs text-status-running tabular-nums">
                {elapsed}s
              </span>
            )}
            <span className="truncate text-muted-foreground">
              · reads the router and mock data, about a minute
            </span>
          </>
        ) : lastDiscovery === null ? null : failed ? (
          <>
            <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />
            <span
              className="min-w-0 flex-1 truncate text-destructive"
              title={lastDiscovery.error ?? undefined}
            >
              Discovery failed: {lastDiscovery.error ?? 'no reason given.'}
            </span>
            <DiscoveryCost discovery={lastDiscovery} />
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              Last discovery {formatRelative(lastDiscovery.finishedAt, now)}
            </span>
            <DiscoveryCost discovery={lastDiscovery} />
          </>
        )}
      </p>
    </div>
  )
}

function DiscoveryCost({ discovery }: { discovery: RouteDiscovery }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
      {formatUsd(discovery.costUsd)} · {formatDuration(discovery.durationMs)}
    </span>
  )
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full bg-muted px-2 text-[0.6875rem] leading-none font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

function EmptyState({
  discovering,
  onDiscover,
}: {
  discovering: boolean
  onDiscover: () => void
}) {
  return (
    <div className="flex h-36 flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 text-center">
      <MapIcon aria-hidden="true" className="size-5 text-muted-foreground" />
      <p className="max-w-md text-[0.8125rem] text-muted-foreground">{EXPLAINER}</p>
      <Button type="button" size="sm" disabled={discovering} onClick={onDiscover}>
        {discovering ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <MapIcon aria-hidden="true" />
        )}
        {discovering ? 'Discovering…' : 'Discover routes'}
      </Button>
    </div>
  )
}

function RouteList({
  routes,
  disabled,
  onEdit,
  onRemove,
}: {
  routes: RouteEntry[]
  disabled: boolean
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  if (routes.length === 0) {
    return (
      <p className="flex h-24 items-center justify-center rounded-md border border-dashed text-[0.8125rem] text-muted-foreground">
        The map is empty. Add a route or rediscover.
      </p>
    )
  }
  return (
    <ul className="min-h-0 scrollbar-thin divide-y overflow-y-auto rounded-md border">
      {routes.map((route, index) => (
        <li
          key={`${route.path}-${index}`}
          className="group grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-[0.8125rem] font-medium">{route.title}</span>
              <span className="truncate font-mono text-xs" title={route.path}>
                {route.path}
              </span>
              {route.example === route.path ? null : (
                <span
                  className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                  title={route.example}
                >
                  {route.example}
                </span>
              )}
            </p>
            <p
              className="truncate text-xs leading-4 text-muted-foreground"
              title={route.description || undefined}
            >
              {route.description || ' '}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ComponentsCount files={route.components} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${route.title}`}
              disabled={disabled}
              onClick={() => onEdit(index)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${route.title}`}
              disabled={disabled}
              onClick={() => onRemove(index)}
              className="text-muted-foreground hover:text-status-failed"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function ComponentsCount({ files }: { files: string[] }) {
  const label = files.length === 1 ? '1 file' : `${files.length} files`
  if (files.length === 0) {
    return (
      <span className="w-16 text-right font-mono text-[0.6875rem] text-muted-foreground/60 tabular-nums">
        no files
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex w-16 items-center justify-end gap-1 rounded-sm font-mono text-[0.6875rem] text-muted-foreground tabular-nums hover:text-foreground"
          aria-label={`${label}: ${files.join(', ')}`}
        >
          <FileCode2 aria-hidden="true" className="size-3" />
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-md">
        <ul className="flex flex-col gap-0.5 font-mono text-[0.6875rem]">
          {files.map((file) => (
            <li key={file} className="break-all">
              {file}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

function RouteDialogBody({
  route,
  pending,
  onCancel,
  onSave,
}: {
  route: RouteEntry | undefined
  pending: boolean
  onCancel: () => void
  onSave: (route: RouteEntry) => void
}) {
  const [errors, setErrors] = useState<Partial<Record<RouteField, string>>>({})
  const form = useForm({
    defaultValues: route === undefined ? EMPTY_ROUTE : toRouteValues(route),
    onSubmit: ({ value }) => {
      const parsed = parseRouteValues(value)
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      setErrors({})
      onSave(parsed.route)
    },
  })
  const errs = (field: RouteField) => {
    const message = errors[field]
    return message === undefined ? [] : [message]
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>{route === undefined ? 'Add route' : 'Edit route'}</DialogTitle>
        <DialogDescription>
          Saving marks the map as edited by you; it won&rsquo;t be regenerated automatically.
        </DialogDescription>
      </DialogHeader>
      <form.Field name="title">
        {(field) => (
          <FormField id={fieldId('title')} label="Title" errors={errs('title')}>
            <Input
              id={fieldId('title')}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Project board"
              aria-invalid={errors.title === undefined ? undefined : true}
            />
          </FormField>
        )}
      </form.Field>
      <div className="grid grid-cols-2 gap-3">
        <form.Field name="path">
          {(field) => (
            <FormField id={fieldId('path')} label="Path pattern" errors={errs('path')}>
              <Input
                id={fieldId('path')}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="/projects/:id"
                className="font-mono"
                aria-invalid={errors.path === undefined ? undefined : true}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name="example">
          {(field) => (
            <FormField id={fieldId('example')} label="Example URL" errors={errs('example')}>
              <Input
                id={fieldId('example')}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="/projects/482"
                className="font-mono"
                aria-invalid={errors.example === undefined ? undefined : true}
              />
            </FormField>
          )}
        </form.Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        The example must open against the preview&rsquo;s data. Empty: the pattern is used.
      </p>
      <form.Field name="description">
        {(field) => (
          <FormField
            id={fieldId('description')}
            label="Description"
            errors={errs('description')}
          >
            <Textarea
              id={fieldId('description')}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={2}
              placeholder="What the screen shows and its notable states"
              className="min-h-14 text-[0.8125rem]"
            />
          </FormField>
        )}
      </form.Field>
      <form.Field name="components">
        {(field) => (
          <FormField id={fieldId('components')} label="Files" errors={errs('components')}>
            <Textarea
              id={fieldId('components')}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={4}
              wrap="off"
              placeholder={'src/routes/projects/$id.tsx\nsrc/features/board/board.tsx'}
              className="min-h-20 font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Repo-relative files that render this screen, one per line. A diff touching them
              points QA here.
            </p>
          </FormField>
        )}
      </form.Field>
      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {route === undefined ? 'Add route' : 'Save route'}
        </Button>
      </DialogFooter>
    </form>
  )
}
