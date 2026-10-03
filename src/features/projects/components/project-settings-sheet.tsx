import { useForm, useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
  MonitorPlay,
  Plus,
  Save,
  ScanSearch,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/form-field'
import { ImageThumb } from '@/components/image-lightbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  apiAssetUrl,
  previewQueries,
  useDetectPreview,
  useTestPreview,
  useUpdateProject,
} from '@/features/projects/api/preview-queries'
import { OfferQaCallout } from '@/features/projects/components/offer-qa-callout'
import {
  DELETE_CONSEQUENCES,
  DeleteProjectDialog,
} from '@/features/projects/components/delete-project-dialog'
import { remoteQueries } from '@/features/projects/api/remote-queries'
import { RoutesSettings } from '@/features/projects/components/routes-settings'
import {
  applyDetectedPreview,
  parsePreviewValues,
  toPreviewValues,
  type PreviewField,
} from '@/features/projects/utils/preview-form'
import { originLabel } from '@/features/projects/utils/remote'
import { CopyButton } from '@/components/copy-button'
import { useNow } from '@/hooks/use-now'
import { ApiError, errorMessage } from '@/lib/api-client'
import type {
  PreviewDetection,
  PreviewTestResult,
  Project,
  ProjectRemote,
} from '@/lib/contracts'
import { DELIVERY_MODES, DELIVERY_OPTIONS, isPrMode } from '@/lib/delivery'
import { formatDuration, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

export const SETTINGS_SECTIONS = ['preview', 'routes', 'delivery', 'general'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

const SECTION_LABEL: Record<SettingsSection, string> = {
  preview: 'Preview',
  routes: 'Routes',
  delivery: 'Delivery',
  general: 'General',
}

const id = (field: string) => `preview-${field}`

/**
 * Project settings, opened from the project top bar (`?settings=<section>`).
 * Preview (how QA runs the app), Routes (the planner's screen map), Delivery.
 */
export function ProjectSettingsSheet({
  project,
  section,
  onSectionChange,
  onOpenChange,
  autoDetect = false,
  onAutoDetected,
  onDeleted,
}: {
  project: Project | undefined
  /** Open on this section; undefined = closed. */
  section: SettingsSection | undefined
  onSectionChange: (section: SettingsSection) => void
  onOpenChange: (open: boolean) => void
  /** Run "Detect from repo" once on open when the project has no preview (new-project flow). */
  autoDetect?: boolean
  /** Called when the auto-detect request was consumed, so the caller can drop the flag. */
  onAutoDetected?: () => void
  /** After a delete: leave the project (navigate away). Caches drop it afterwards. */
  onDeleted: () => Promise<void>
}) {
  const open = section !== undefined
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // Focus the sheet, not the first tab, so no focus ring flashes on open.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
        className="flex w-full flex-col gap-0 focus-visible:outline-none data-[side=right]:w-[min(720px,92vw)] data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b">
          <div className="flex flex-col gap-0.5">
            <SheetTitle>Project settings</SheetTitle>
            <SheetDescription>{project?.name ?? 'Project'}</SheetDescription>
          </div>
        </SheetHeader>
        <Tabs
          value={section ?? 'preview'}
          onValueChange={(value) => {
            const next = SETTINGS_SECTIONS.find((s) => s === value)
            if (next !== undefined) onSectionChange(next)
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex h-10 shrink-0 items-center border-b px-4">
            <TabsList variant="line" className="h-10 gap-4 p-0">
              {SETTINGS_SECTIONS.map((value) => (
                <TabsTrigger key={value} value={value} className="px-0 text-[0.8125rem]">
                  {SECTION_LABEL[value]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {project === undefined ? (
            <div className="flex flex-col gap-3 p-4" aria-busy="true">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Kept mounted so unsaved preview edits survive a tab switch. */}
              <TabsContent
                value="preview"
                forceMount
                className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
              >
                {/* Remount when the saved config changes so the form starts from it. */}
                <PreviewSettings
                  key={JSON.stringify(project.preview)}
                  project={project}
                  autoDetect={autoDetect}
                  onAutoDetected={onAutoDetected}
                />
              </TabsContent>
              <TabsContent value="routes" className="flex min-h-0 flex-1 flex-col">
                <RoutesSettings projectId={project.id} />
              </TabsContent>
              <TabsContent value="delivery" className="flex min-h-0 flex-1 flex-col">
                <DeliverySettings project={project} />
              </TabsContent>
              <TabsContent value="general" className="flex min-h-0 flex-1 flex-col">
                <GeneralSettings project={project} onDeleted={onDeleted} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

/** "Preview ready / failing / Not tested" from the last test result. */
export function PreviewStatusChip({
  last,
  configured,
}: {
  last: PreviewTestResult | null | undefined
  configured: boolean
}) {
  const state = !configured
    ? { icon: CircleDashed, label: 'Not set up', tone: 'bg-muted text-muted-foreground' }
    : last == null
      ? { icon: CircleDashed, label: 'Not tested', tone: 'bg-muted text-muted-foreground' }
      : last.ok
        ? {
            icon: CircleCheck,
            label: 'Preview ready',
            tone: 'bg-status-passed-soft text-status-passed',
          }
        : {
            icon: CircleX,
            label: 'Preview failing',
            tone: 'bg-status-failed-soft text-status-failed',
          }
  const Icon = state.icon
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 pr-2 text-[0.6875rem] leading-none font-medium whitespace-nowrap',
        state.tone,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {state.label}
    </span>
  )
}

function GeneralSettings({
  project,
  onDeleted,
}: {
  project: Project
  onDeleted: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="relative flex min-h-0 flex-1 scrollbar-thin flex-col gap-8 overflow-y-auto p-4">
      <section aria-labelledby="general-heading" className="flex flex-col gap-3">
        <h2 id="general-heading" className="text-sm font-semibold">
          General
        </h2>
        <dl className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md border bg-card/50 px-3 py-2.5 text-[0.8125rem]">
          <dt className="text-muted-foreground">Repository</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 font-mono text-xs break-all">{project.repoPath}</span>
            <CopyButton value={project.repoPath} label="Copy the repository path" />
          </dd>
          <dt className="text-muted-foreground">Base branch</dt>
          <dd className="font-mono text-xs">{project.baseBranch}</dd>
        </dl>
      </section>

      <section
        aria-labelledby="danger-heading"
        className="flex flex-col gap-3 rounded-md border border-destructive/40 p-4"
      >
        <h2 id="danger-heading" className="text-sm font-semibold text-destructive">
          Danger zone
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-[0.8125rem] font-medium">Delete project</p>
            <p className="text-xs text-muted-foreground">{DELETE_CONSEQUENCES}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 aria-hidden="true" />
            Delete project…
          </Button>
        </div>
      </section>

      <DeleteProjectDialog
        project={project}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </div>
  )
}

function DeliverySettings({ project }: { project: Project }) {
  const update = useUpdateProject(project.id)
  const remote = useQuery(remoteQueries.detail(project.id))
  // Show the requested value while the PATCH is in flight.
  const selected = update.isPending
    ? (update.variables.deliveryDefault ?? project.deliveryDefault)
    : project.deliveryDefault
  const blocked =
    remote.data?.prPossible === false
      ? (remote.data.reason ?? 'Pull requests can’t be opened.')
      : null

  function choose(value: string) {
    const deliveryDefault = DELIVERY_MODES.find((mode) => mode === value)
    if (deliveryDefault === undefined || deliveryDefault === project.deliveryDefault) return
    update.mutate(
      { deliveryDefault },
      {
        onSuccess: () =>
          toast.success(
            `Approving the final gate now defaults to “${DELIVERY_OPTIONS[deliveryDefault].menuLabel}”.`,
          ),
        onError: (error) => toast.error(`Couldn't change delivery: ${errorMessage(error)}`),
      },
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 scrollbar-thin flex-col gap-4 overflow-y-auto p-4">
      <section aria-labelledby="delivery-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="delivery-heading" className="text-sm font-semibold">
            When you approve the final gate
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            You can still pick another option on each approval.
          </p>
        </div>

        <RemoteStatus remote={remote.data} pending={remote.isPending} />

        <RadioGroup
          value={selected}
          onValueChange={choose}
          disabled={update.isPending}
          aria-labelledby="delivery-heading"
          className="gap-2"
        >
          {DELIVERY_MODES.map((mode) => {
            const prBlocked = blocked !== null && isPrMode(mode)
            const checked = selected === mode
            const itemId = `delivery-${mode}`
            return (
              <Label
                key={mode}
                htmlFor={itemId}
                className={cn(
                  'flex items-start gap-3 rounded-md border bg-card/50 px-3 py-2.5 font-normal transition-colors',
                  checked ? 'border-foreground/40 bg-card' : 'hover:bg-card',
                  // A stored PR default stays selectable-looking so it isn't silently changed.
                  prBlocked && !checked && 'opacity-60',
                )}
              >
                <RadioGroupItem
                  id={itemId}
                  value={mode}
                  disabled={prBlocked && !checked}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.8125rem] font-medium">
                    {DELIVERY_OPTIONS[mode].menuLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {DELIVERY_OPTIONS[mode].hint}
                  </span>
                  {prBlocked ? (
                    <span className="flex items-center gap-1 text-xs text-status-queued">
                      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                      {checked
                        ? `Won’t work right now. ${blocked} Approvals commit locally until it’s fixed.`
                        : blocked}
                    </span>
                  ) : null}
                </span>
              </Label>
            )
          })}
        </RadioGroup>
      </section>
    </div>
  )
}

/** "origin · github.com/owner/repo · gh logged in", or why PRs can't be opened. */
function RemoteStatus({
  remote,
  pending,
}: {
  remote: ProjectRemote | undefined
  pending: boolean
}) {
  if (remote === undefined) {
    return pending ? (
      <Skeleton className="h-9 w-full" />
    ) : (
      <p className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-xs text-muted-foreground">
        Couldn&rsquo;t check the repo&rsquo;s remote.
      </p>
    )
  }
  const ok = remote.prPossible
  return (
    <p className="flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-xs">
      {ok ? (
        <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-status-passed" />
      ) : (
        <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-status-queued" />
      )}
      {ok && remote.origin !== null ? (
        <span className="min-w-0 break-all">
          <span className="text-muted-foreground">origin · </span>
          <span className="font-mono">{originLabel(remote.origin)}</span>
          <span className="text-muted-foreground"> · gh logged in</span>
        </span>
      ) : (
        <span className="min-w-0 text-muted-foreground">
          {remote.reason ?? 'Pull requests can’t be opened from this repo.'}
          {remote.origin === null ? null : (
            <>
              {' '}
              <span className="font-mono">({originLabel(remote.origin)})</span>
            </>
          )}
        </span>
      )}
    </p>
  )
}

function PreviewSettings({
  project,
  autoDetect,
  onAutoDetected,
}: {
  project: Project
  autoDetect: boolean
  onAutoDetected?: () => void
}) {
  const update = useUpdateProject(project.id)
  const test = useTestPreview(project.id)
  const detect = useDetectPreview(project.id)
  const status = useQuery(previewQueries.status(project.id))
  const [errors, setErrors] = useState<Partial<Record<PreviewField, string>>>({})
  const configured = project.preview !== null
  const initial = toPreviewValues(project.preview)

  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => {
      const parsed = parsePreviewValues(value)
      if (!parsed.ok) {
        setErrors(parsed.errors)
        return
      }
      setErrors({})
      update.mutate(
        { preview: parsed.preview },
        {
          onSuccess: () => toast.success('Preview saved.'),
          onError: (error) => toast.error(`Couldn't save the preview: ${errorMessage(error)}`),
        },
      )
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)

  const errs = (field: PreviewField) => {
    const message = errors[field]
    return message === undefined ? [] : [message]
  }

  function runTest() {
    test.mutate(undefined, {
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.code === 'preview_not_configured'
            ? 'Save a preview config first.'
            : `Couldn't test the preview: ${errorMessage(error)}`,
        ),
    })
  }

  function remove() {
    update.mutate(
      { preview: null },
      {
        onSuccess: () =>
          toast.success('Preview removed. QA stations will fail until it is set up again.'),
        onError: (error) => toast.error(`Couldn't remove the preview: ${errorMessage(error)}`),
      },
    )
  }

  /** Fills the form from the repo (unsaved). With nothing runnable found, the form stays as is. */
  function runDetect() {
    detect.mutate(undefined, {
      onSuccess: (detection) => {
        if (detection.preview === null) return
        form.reset(applyDetectedPreview(form.state.values, detection.preview), {
          keepDefaultValues: true,
        })
        setErrors({})
      },
      onError: (error) => toast.error(`Couldn't detect the preview: ${errorMessage(error)}`),
    })
  }

  // New-project flow: detect once on open. The ref survives StrictMode's double effect.
  const autoDetected = useRef(false)
  useEffect(() => {
    if (!autoDetect || autoDetected.current) return
    autoDetected.current = true
    onAutoDetected?.()
    if (project.preview === null) runDetect()
  })

  const last = test.data ?? status.data?.last

  return (
    <>
      <form
        className="relative flex min-h-0 flex-1 scrollbar-thin flex-col gap-5 overflow-y-auto p-4"
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <section aria-labelledby="preview-heading" className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 id="preview-heading" className="text-sm font-semibold">
                Preview
              </h2>
              <p className="text-[0.8125rem] text-muted-foreground">
                How to run the app locally. QA stations boot it twice — base branch and the work
                order&rsquo;s branch — and compare screenshots.
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {status.isPending && configured ? (
                <Skeleton className="h-5 w-24 rounded-full" />
              ) : (
                <PreviewStatusChip last={last} configured={configured} />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={detect.isPending}
                onClick={runDetect}
              >
                {detect.isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <ScanSearch aria-hidden="true" />
                )}
                {detect.isPending ? 'Detecting…' : 'Detect from repo'}
              </Button>
            </div>
          </div>

          <div aria-live="polite">
            {detect.data === undefined || detect.isPending ? null : (
              <DetectionSummary detection={detect.data} />
            )}
          </div>

          <form.Field name="install">
            {(field) => (
              <FormField id={id('install')} label="Install command" errors={errs('install')}>
                <Input
                  id={id('install')}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="pnpm install --frozen-lockfile"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Runs once per worktree before start.
                </p>
              </FormField>
            )}
          </form.Field>
          <form.Field name="start">
            {(field) => (
              <FormField id={id('start')} label="Start command" errors={errs('start')}>
                <Input
                  id={id('start')}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="pnpm dev --port $PORT"
                  className="font-mono"
                  aria-invalid={errors.start === undefined ? undefined : true}
                />
                <p className="text-xs text-muted-foreground">
                  <code className="rounded-sm bg-muted px-1 font-mono">$PORT</code> is injected
                  (also as the <code className="rounded-sm bg-muted px-1 font-mono">PORT</code>{' '}
                  env var) — serve the app on it.{' '}
                  <code className="rounded-sm bg-muted px-1 font-mono">$PORT2</code> is a second
                  free port, e.g. for a mock API; both are also replaced in env values.
                </p>
              </FormField>
            )}
          </form.Field>
          <div className="grid grid-cols-3 gap-3">
            <form.Field name="readyPath">
              {(field) => (
                <FormField id={id('readyPath')} label="Ready path" errors={errs('readyPath')}>
                  <Input
                    id={id('readyPath')}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="/"
                    className="font-mono"
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="readyTimeoutSec">
              {(field) => (
                <FormField
                  id={id('readyTimeoutSec')}
                  label="Ready timeout (s)"
                  errors={errs('readyTimeoutSec')}
                >
                  <Input
                    id={id('readyTimeoutSec')}
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={900}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="tabular"
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name="baseUrlPath">
              {(field) => (
                <FormField
                  id={id('baseUrlPath')}
                  label="Base URL path"
                  errors={errs('baseUrlPath')}
                >
                  <Input
                    id={id('baseUrlPath')}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="/"
                    className="font-mono"
                  />
                </FormField>
              )}
            </form.Field>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            The ready path is polled until it answers 2xx/3xx. The base URL path prefixes every
            checked route.
          </p>

          <form.Field name="env" mode="array">
            {(field) => (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Environment</legend>
                {field.state.value.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No extra variables. Use them to switch on mocks or a seeded user, e.g.{' '}
                    <code className="rounded-sm bg-muted px-1 font-mono">VITE_MOCKS=1</code>.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {field.state.value.map((_row, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] gap-1.5"
                      >
                        <form.Field name={`env[${index}].key`}>
                          {(sub) => (
                            <Input
                              aria-label={`Variable ${index + 1} name`}
                              value={sub.state.value}
                              onChange={(event) => sub.handleChange(event.target.value)}
                              placeholder="NAME"
                              className="font-mono"
                            />
                          )}
                        </form.Field>
                        <form.Field name={`env[${index}].value`}>
                          {(sub) => (
                            <Input
                              aria-label={`Variable ${index + 1} value`}
                              value={sub.state.value}
                              onChange={(event) => sub.handleChange(event.target.value)}
                              placeholder="value"
                              className="font-mono"
                            />
                          )}
                        </form.Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-8"
                          aria-label={`Remove variable ${index + 1}`}
                          onClick={() => field.removeValue(index)}
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {errors.env === undefined ? null : (
                  <p className="text-xs text-destructive">{errors.env}</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => field.pushValue({ key: '', value: '' })}
                >
                  <Plus aria-hidden="true" />
                  Add variable
                </Button>
              </fieldset>
            )}
          </form.Field>

          <form.Field name="themeInit">
            {(field) => (
              <FormField id={id('themeInit')} label="Init script" errors={errs('themeInit')}>
                <Textarea
                  id={id('themeInit')}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  rows={4}
                  placeholder={`localStorage.setItem('theme', theme)`}
                  className="font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  Runs in every page before load (captures and the QA browser).{' '}
                  <code className="rounded-sm bg-muted px-1 font-mono">theme</code> is
                  &ldquo;light&rdquo; or &ldquo;dark&rdquo;;{' '}
                  <code className="rounded-sm bg-muted px-1 font-mono">$PORT</code>/
                  <code className="rounded-sm bg-muted px-1 font-mono">$PORT2</code> are
                  replaced. Use it to apply a theme or seed a session in localStorage. Empty:
                  themes are emulated with prefers-color-scheme.
                </p>
              </FormField>
            )}
          </form.Field>
        </section>

        <PreviewTest
          configured={configured}
          dirty={dirty}
          pending={test.isPending}
          startedAt={test.submittedAt}
          timeoutSec={project.preview?.readyTimeoutSec ?? null}
          last={last ?? null}
          onTest={runTest}
        />
        {!test.isPending && last?.ok === true ? (
          <OfferQaCallout projectId={project.id} variant="inline" />
        ) : null}
      </form>

      <SheetFooter className="flex-row items-center gap-2 border-t">
        {configured ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={remove}
            className="border-status-failed/40 text-status-failed hover:bg-status-failed-soft hover:text-status-failed"
          >
            <Trash2 aria-hidden="true" />
            Remove preview
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {update.isPending ? 'Saving…' : dirty ? 'Unsaved changes' : configured ? 'Saved' : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!dirty || update.isPending}
          onClick={() => {
            form.reset(initial)
            setErrors({})
          }}
        >
          <Undo2 aria-hidden="true" />
          Discard
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!dirty || update.isPending}
          onClick={() => void form.handleSubmit()}
        >
          <Save aria-hidden="true" />
          Save preview
        </Button>
      </SheetFooter>
    </>
  )
}

function DetectionSummary({ detection }: { detection: PreviewDetection }) {
  const chips = [
    detection.framework,
    detection.packageManager,
    detection.nodeVersion === null ? null : `Node ${detection.nodeVersion}`,
  ].filter((chip) => chip !== null)
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card/50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <p className="mr-1 text-[0.8125rem] font-medium">
          {detection.preview === null
            ? 'Nothing runnable found. The form is unchanged.'
            : 'Filled in from the repo. Check it, then save.'}
        </p>
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex h-5 items-center rounded-sm border bg-muted px-1.5 font-mono text-[0.6875rem] text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
      {detection.notes.length === 0 ? null : (
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-muted-foreground">
          {detection.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PreviewTest({
  configured,
  dirty,
  pending,
  startedAt,
  timeoutSec,
  last,
  onTest,
}: {
  configured: boolean
  dirty: boolean
  pending: boolean
  startedAt: number
  timeoutSec: number | null
  last: PreviewTestResult | null
  onTest: () => void
}) {
  const now = useNow(1000, pending)
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000))

  return (
    <section
      aria-labelledby="preview-test-heading"
      className="flex flex-col gap-3 border-t pt-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="preview-test-heading" className="text-sm font-semibold">
            Test preview
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            {!configured
              ? 'Save a config first — the test boots the saved one.'
              : dirty
                ? 'Tests the saved config, not your unsaved changes.'
                : 'Boots the app once on the base branch and screenshots the ready path.'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={!configured || pending}
          onClick={onTest}
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <MonitorPlay aria-hidden="true" />
          )}
          Test preview
        </Button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-3">
        {pending ? (
          <p className="flex h-8 items-center gap-2 rounded-md bg-status-running-soft px-2.5 text-[0.8125rem] text-status-running">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Booting the preview…
            <span className="ml-auto font-mono text-xs tabular-nums">
              {elapsed}s{timeoutSec === null ? '' : ` / ${timeoutSec}s`}
            </span>
          </p>
        ) : last === null ? null : (
          <PreviewTestResultView key={last.testedAt} result={last} />
        )}
      </div>
    </section>
  )
}

function PreviewTestResultView({ result }: { result: PreviewTestResult }) {
  // It's a tail: open at the end, where the failure usually is.
  const toEnd = useCallback((element: HTMLPreElement | null) => {
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [])
  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          'flex min-h-8 items-center gap-2 rounded-md px-2.5 py-1.5 text-[0.8125rem]',
          result.ok
            ? 'bg-status-passed-soft text-status-passed'
            : 'bg-status-failed-soft text-status-failed',
        )}
      >
        {result.ok ? (
          <CircleCheck aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <CircleX aria-hidden="true" className="size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          {result.ok ? 'The preview came up.' : (result.error ?? 'The preview failed.')}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {formatDuration(result.durationMs)} · {formatRelative(result.testedAt)}
        </span>
      </p>
      <div className="flex items-start gap-3">
        {result.screenshotUrl === null ? null : (
          <ImageThumb
            images={[
              {
                src: apiAssetUrl(result.screenshotUrl),
                caption: 'Preview screenshot · ready path on the base branch',
              },
            ]}
            className="h-[150px] w-[240px]"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="label-caps">Log tail</span>
          <pre
            ref={toEnd}
            className="h-[150px] scrollbar-thin overflow-auto rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[0.75rem] leading-relaxed whitespace-pre text-muted-foreground"
          >
            {result.logs.trim() === '' ? 'No output.' : result.logs.trimEnd()}
          </pre>
        </div>
      </div>
    </div>
  )
}
