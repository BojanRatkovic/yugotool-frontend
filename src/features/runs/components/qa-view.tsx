import { useQuery } from '@tanstack/react-query'
import {
  Accessibility,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Columns2,
  Expand,
  Image as ImageIcon,
  ImageOff,
  Layers,
  LoaderCircle,
  Maximize,
  MousePointerClick,
  Scan,
  Settings2,
  SplitSquareHorizontal,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'

import {
  ImageThumb,
  useLightbox,
  ZoomableImage,
  type LightboxImage,
} from '@/components/image-lightbox'
import { TONE_SOFT, TONE_TEXT, type Tone } from '@/components/status/status'
import { StatusChip } from '@/components/status/status-chip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { qaQueries, useAcceptQaCheck } from '@/features/runs/api/qa-queries'
import { runQueries } from '@/features/runs/api/run-queries'
import {
  canAccept,
  defaultCheck,
  formatQaCounts,
  groupChecks,
  noVisualChanges,
  noteLines,
  qaCounts,
  qaFileUrl,
  selectAttempt,
} from '@/features/runs/utils/qa'
import { logTail } from '@/features/runs/utils/activity'
import { errorMessage } from '@/lib/api-client'
import type {
  QaCheck,
  QaCheckKind,
  QaCheckStatus,
  QaRun,
  QaRunStatus,
  Run,
} from '@/lib/contracts'
import { formatRelative, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<QaCheckKind, LucideIcon> = {
  visual: ImageIcon,
  scenario: MousePointerClick,
  console: SquareTerminal,
  a11y: Accessibility,
}

const KIND_LABEL: Record<QaCheckKind, string> = {
  visual: 'Visual',
  scenario: 'Scenario',
  console: 'Console',
  a11y: 'Accessibility',
}

/** Check status on the shared tone scale, with its own shape and word. */
const CHECK_STATUS: Record<QaCheckStatus, { tone: Tone; icon: LucideIcon; label: string }> = {
  fail: { tone: 'failed', icon: CircleX, label: 'Failed' },
  changed: { tone: 'waiting', icon: SplitSquareHorizontal, label: 'Changed' },
  error: { tone: 'cancelled', icon: CircleAlert, label: 'Error' },
  intended: { tone: 'passed', icon: BadgeCheck, label: 'Intended' },
  pass: { tone: 'passed', icon: CircleCheck, label: 'Passed' },
}

const RUN_STATUS: Record<
  QaRunStatus,
  { status: 'running' | 'succeeded' | 'failed'; label: string }
> = {
  running: { status: 'running', label: 'Running' },
  passed: { status: 'succeeded', label: 'Passed' },
  failed: { status: 'failed', label: 'Failed' },
  error: { status: 'failed', label: 'Error' },
}

function CheckStatusIcon({ status, className }: { status: QaCheckStatus; className?: string }) {
  const { icon: Icon, tone, label } = CHECK_STATUS[status]
  return (
    <>
      <Icon
        aria-hidden="true"
        className={cn('size-3.5 shrink-0', TONE_TEXT[tone], className)}
      />
      <span className="sr-only">{label}</span>
    </>
  )
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 shrink-0 items-center rounded-sm bg-muted px-1 font-mono text-[0.6875rem] leading-none text-muted-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}

function formatDiff(pct: number | null): string | null {
  if (pct === null) return null
  return `${pct < 0.01 && pct > 0 ? '<0.01' : pct.toFixed(pct < 10 ? 2 : 1)}%`
}

/**
 * The QA tab: one QA attempt at a time — checks grouped by status on the
 * left, a base/PR viewer (side by side, slider, diff overlay) on the right.
 */
export function QaView({
  run,
  attempt,
  checkId,
  onSelect,
  onEditPreview,
}: {
  run: Run
  attempt: number | undefined
  checkId: string | undefined
  onSelect: (next: { attempt?: number; check?: string }) => void
  onEditPreview: () => void
}) {
  const qa = useQuery(qaQueries.list(run.id))

  if (qa.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-[16rem_minmax(0,1fr)] gap-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    )
  }
  if (qa.error !== null && qa.data === undefined) {
    return (
      <p className="p-4 text-sm text-status-failed">
        QA results are unavailable: {qa.error.message}
      </p>
    )
  }

  const runs = qa.data ?? []
  const current = selectAttempt(runs, attempt)
  if (current === undefined) {
    return (
      <div className="flex flex-col items-start gap-1 p-6">
        <p className="text-sm font-medium">QA hasn&rsquo;t run yet</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          Screenshots of the base branch and this branch show up here once the QA station
          starts.
        </p>
      </div>
    )
  }

  return (
    <QaAttempt
      key={current.id}
      run={run}
      qaRun={current}
      attempts={runs.length}
      checkId={checkId}
      onSelect={onSelect}
      onEditPreview={onEditPreview}
    />
  )
}

function QaAttempt({
  run,
  qaRun,
  attempts,
  checkId,
  onSelect,
  onEditPreview,
}: {
  run: Run
  qaRun: QaRun
  attempts: number
  checkId: string | undefined
  onSelect: (next: { attempt?: number; check?: string }) => void
  onEditPreview: () => void
}) {
  const counts = qaCounts(qaRun.checks)
  const groups = groupChecks(qaRun.checks)
  const selected = defaultCheck(qaRun.checks, checkId)
  const status = RUN_STATUS[qaRun.status]

  return (
    // Fills the panel's scroll area (like the diff) so the check list and the
    // detail scroll independently and the panel itself never scrolls.
    <div className="absolute inset-0 flex min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6"
            aria-label="Previous attempt"
            disabled={qaRun.attempt <= 1}
            onClick={() => onSelect({ attempt: qaRun.attempt - 1, check: undefined })}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="text-[0.8125rem] font-medium tabular-nums">
            Attempt {qaRun.attempt} of {attempts}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6"
            aria-label="Next attempt"
            disabled={qaRun.attempt >= attempts}
            onClick={() => onSelect({ attempt: qaRun.attempt + 1, check: undefined })}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <StatusChip status={status.status} label={status.label} />
        <span className="ml-auto truncate font-mono text-xs text-muted-foreground tabular-nums">
          {formatQaCounts(counts)}
        </span>
      </div>

      {qaRun.status === 'error' ? (
        <QaError run={run} qaRun={qaRun} onEditPreview={onEditPreview} />
      ) : qaRun.checks.length === 0 ? (
        qaRun.status === 'running' ? (
          <QaBooting run={run} qaRun={qaRun} />
        ) : (
          <div className="flex flex-col items-start gap-1 p-6">
            <p className="text-sm font-medium">No checks</p>
            <p className="text-[0.8125rem] text-muted-foreground">
              {qaRun.summary ?? 'This attempt finished without checking any screen.'}
            </p>
          </div>
        )
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)]">
          <nav
            aria-label="QA checks"
            className="min-h-0 scrollbar-thin overflow-y-auto border-r bg-card/30 py-1"
          >
            {groups.map((group) => (
              <section key={group.status} aria-label={CHECK_STATUS[group.status].label}>
                <h3 className="label-caps flex h-7 items-center gap-1.5 px-3">
                  {CHECK_STATUS[group.status].label}
                  <span className="font-mono tabular-nums">{group.checks.length}</span>
                </h3>
                <ul>
                  {group.checks.map((check) => (
                    <CheckItem
                      key={check.id}
                      check={check}
                      selected={check.id === selected?.id}
                      onSelect={() => onSelect({ check: check.id })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="min-h-0 scrollbar-thin overflow-y-auto">
            {qaRun.summary === null ? null : (
              <p className="border-b px-4 py-2 text-[0.8125rem] text-muted-foreground">
                {qaRun.summary}
              </p>
            )}
            {selected === undefined ? (
              noVisualChanges(qaRun.checks) ? (
                <div className="flex flex-col items-start gap-1 p-6">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <CircleCheck aria-hidden="true" className="size-4 text-status-passed" />
                    No visual changes
                  </p>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Every screen matches the base branch. Pick a check to see its screenshots.
                  </p>
                </div>
              ) : (
                <p className="p-6 text-[0.8125rem] text-muted-foreground">
                  Nothing needs a look. Pick a check to see it.
                </p>
              )
            ) : (
              <CheckViewer key={selected.id} runId={run.id} check={selected} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CheckItem({
  check,
  selected,
  onSelect,
}: {
  check: QaCheck
  selected: boolean
  onSelect: () => void
}) {
  const KindIcon = KIND_ICON[check.kind]
  const diff = check.kind === 'visual' ? formatDiff(check.diffPct) : null
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'flex min-h-12 w-full flex-col justify-center gap-0.5 px-3 py-1.5 text-left transition-colors',
          selected ? 'bg-accent' : 'hover:bg-accent/50',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <KindIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="sr-only">{KIND_LABEL[check.kind]}:</span>
          <span className="min-w-0 flex-1 truncate text-[0.8125rem]" title={check.name}>
            {check.name}
          </span>
          <CheckStatusIcon status={check.status} />
        </span>
        <span className="flex min-w-0 items-center gap-1 pl-5">
          {check.viewport === null ? null : <Chip>{check.viewport}</Chip>}
          {check.theme === null ? null : <Chip>{check.theme}</Chip>}
          {diff === null ? null : (
            <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
              {diff}
            </span>
          )}
        </span>
        {check.reason === null ? null : (
          <span
            className="truncate pl-5 text-[0.6875rem] leading-4 text-muted-foreground"
            title={`Why this screen: ${check.reason}`}
          >
            {check.reason}
          </span>
        )}
      </button>
    </li>
  )
}

type CompareMode = 'side' | 'slider' | 'diff'

function CheckViewer({ runId, check }: { runId: string; check: QaCheck }) {
  const accept = useAcceptQaCheck(runId)
  const [mode, setMode] = useState<CompareMode>('side')
  const [actualSize, setActualSize] = useState(false)
  const status = CHECK_STATUS[check.status]
  const KindIcon = KIND_ICON[check.kind]
  const hasShots = check.baseShot !== null || check.prShot !== null
  const diff = formatDiff(check.diffPct)
  const url = (file: string | null) => (file === null ? null : qaFileUrl(runId, file))
  // One gallery per check: Base / PR / Diff, whichever were captured.
  const where = [check.path, check.viewport, check.theme].filter((part) => part !== null)
  const caption = [check.name, ...where].join(' · ')
  const gallery: LightboxImage[] = (
    [
      ['Base', check.baseShot],
      ['PR', check.prShot],
      ['Diff', check.diffShot],
    ] as const
  ).flatMap(([label, file]) =>
    file === null ? [] : [{ src: qaFileUrl(runId, file), label, caption, detail: file }],
  )
  const at = (label: string) =>
    Math.max(
      0,
      gallery.findIndex((image) => image.label === label),
    )
  const stepGallery: LightboxImage[] = check.steps.flatMap((step, index) =>
    step.shot === null
      ? []
      : [
          {
            src: qaFileUrl(runId, step.shot),
            label: `Step ${index + 1}`,
            caption: [step.action, step.target].filter((part) => part !== null).join(' · '),
            detail: step.shot,
          },
        ],
  )

  return (
    <article aria-label={check.name} className="flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <KindIcon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h3 className="min-w-0 truncate text-sm font-semibold">{check.name}</h3>
        <span
          className={cn(
            'inline-flex h-5 items-center gap-1 rounded-full px-1.5 pr-2 text-[0.6875rem] font-medium',
            TONE_SOFT[status.tone],
            TONE_TEXT[status.tone],
          )}
        >
          <status.icon aria-hidden="true" className="size-3" />
          {status.label}
        </span>
        {check.path === null ? null : <Chip className="h-5 px-1.5">{check.path}</Chip>}
        {check.viewport === null ? null : <Chip className="h-5 px-1.5">{check.viewport}</Chip>}
        {check.theme === null ? null : <Chip className="h-5 px-1.5">{check.theme}</Chip>}
        {diff === null ? null : (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {diff} changed
          </span>
        )}
        {hasShots ? (
          <div className="ml-auto flex items-center gap-2">
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={mode}
              onValueChange={(value) => {
                if (value === 'side' || value === 'slider' || value === 'diff') setMode(value)
              }}
              aria-label="Compare mode"
            >
              <ToggleGroupItem
                value="side"
                aria-label="Side by side"
                className="gap-1 px-2 text-xs"
              >
                <Columns2 aria-hidden="true" />
                Side by side
              </ToggleGroupItem>
              <ToggleGroupItem
                value="slider"
                aria-label="Slider"
                disabled={check.baseShot === null || check.prShot === null}
                className="gap-1 px-2 text-xs"
              >
                <SplitSquareHorizontal aria-hidden="true" />
                Slider
              </ToggleGroupItem>
              <ToggleGroupItem
                value="diff"
                aria-label="Diff overlay"
                disabled={check.diffShot === null || check.prShot === null}
                className="gap-1 px-2 text-xs"
              >
                <Layers aria-hidden="true" />
                Diff
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={actualSize}
              onClick={() => setActualSize((value) => !value)}
            >
              {actualSize ? <Maximize aria-hidden="true" /> : <Scan aria-hidden="true" />}
              {actualSize ? 'Fit' : '1:1'}
            </Button>
          </div>
        ) : null}
      </header>
      {check.reason === null ? null : (
        <p className="-mt-1 text-[0.8125rem] text-muted-foreground">
          <span className="font-medium text-foreground/80">Why this screen:</span>{' '}
          {check.reason}
        </p>
      )}

      {hasShots ? (
        mode === 'slider' && check.baseShot !== null && check.prShot !== null ? (
          <SliderCompare
            base={url(check.baseShot) ?? ''}
            pr={url(check.prShot) ?? ''}
            name={check.name}
            actualSize={actualSize}
            gallery={gallery}
            prIndex={at('PR')}
          />
        ) : mode === 'diff' && check.diffShot !== null && check.prShot !== null ? (
          <DiffOverlay
            pr={url(check.prShot) ?? ''}
            diff={url(check.diffShot) ?? ''}
            name={check.name}
            actualSize={actualSize}
            gallery={gallery}
            diffIndex={at('Diff')}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Shot
              label="Base"
              src={url(check.baseShot)}
              name={check.name}
              actualSize={actualSize}
              gallery={gallery}
              index={at('Base')}
            />
            <Shot
              label="PR"
              src={url(check.prShot)}
              name={check.name}
              actualSize={actualSize}
              gallery={gallery}
              index={at('PR')}
            />
          </div>
        )
      ) : null}

      <CheckNote check={check} />

      {check.steps.length === 0 ? null : (
        <section aria-label="Steps" className="flex flex-col gap-1.5">
          <h4 className="label-caps">Steps</h4>
          <ol className="flex flex-col gap-2">
            {check.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                {step.ok ? (
                  <CircleCheck
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-status-passed"
                  />
                ) : (
                  <CircleX
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-status-failed"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-mono text-[0.75rem] leading-5">
                    <span className="sr-only">{step.ok ? 'OK: ' : 'Failed: '}</span>
                    <span className="text-foreground">{step.action}</span>
                    {step.target === null ? null : (
                      <span className="text-muted-foreground"> · {step.target}</span>
                    )}
                  </p>
                  {step.note === null ? null : (
                    <p className="text-xs text-muted-foreground">{step.note}</p>
                  )}
                </div>
                {step.shot === null ? null : (
                  <ImageThumb
                    images={stepGallery}
                    index={Math.max(
                      0,
                      stepGallery.findIndex((image) => image.label === `Step ${index + 1}`),
                    )}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {canAccept(check) || check.acceptedAt !== null ? (
        <div className="flex items-center gap-3 border-t pt-3">
          {check.acceptedAt !== null ? (
            <p className="flex items-center gap-1.5 text-[0.8125rem] text-status-passed">
              <BadgeCheck aria-hidden="true" className="size-3.5" />
              Accepted as intended {formatRelative(check.acceptedAt)}
            </p>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(check.id, {
                    onSuccess: () => toast.success(`Marked “${check.name}” as intended.`),
                    onError: (error) =>
                      toast.error(`Couldn't accept the check: ${errorMessage(error)}`),
                  })
                }
              >
                {accept.isPending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <BadgeCheck aria-hidden="true" />
                )}
                Accept as intended
              </Button>
              <p className="text-xs text-muted-foreground">
                Records your override for this run and the PR body. It doesn&rsquo;t restart QA.
              </p>
            </>
          )}
        </div>
      ) : null}
    </article>
  )
}

function CheckNote({ check }: { check: QaCheck }) {
  // Severity only means something on a defect; older rows carry it on passes too.
  const severity = check.status === 'fail' ? check.severity : null
  if (check.note === null && severity === null) return null
  const list = check.kind === 'console' || check.kind === 'a11y'
  const lines = list ? noteLines(check.note) : []
  return (
    <section aria-label="Judge's note" className="flex flex-col gap-1.5">
      <h4 className="label-caps flex items-center gap-2">
        {list ? (check.kind === 'console' ? 'New console errors' : 'New violations') : 'Note'}
        {severity === null ? null : (
          <span
            className={cn(
              'rounded-sm px-1 py-0.5 text-[0.6875rem] leading-none font-medium tracking-normal normal-case',
              severity === 'critical'
                ? 'bg-status-failed-soft text-status-failed'
                : severity === 'important'
                  ? 'bg-status-waiting-soft text-status-waiting'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {severity}
          </span>
        )}
      </h4>
      {list && lines.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-md border bg-muted/30">
          {lines.map((line, index) => (
            <li
              key={index}
              className="truncate px-2.5 py-1 font-mono text-[0.75rem] leading-5 text-muted-foreground"
              title={line}
            >
              {line}
            </li>
          ))}
        </ul>
      ) : check.note === null ? null : (
        <p className="max-w-[72ch] text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-foreground/90">
          {check.note}
        </p>
      )}
    </section>
  )
}

/** Image frame: fitted to the column, or actual pixels in its own scroll box. */
function Frame({
  actualSize,
  scroll = false,
  children,
}: {
  actualSize: boolean
  /** Scroll vertically even when fitted (tall full-page shots in the slider). */
  scroll?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-md border bg-muted/40',
        actualSize
          ? 'max-h-[70vh] scrollbar-thin overflow-auto'
          : scroll
            ? 'max-h-[70vh] scrollbar-thin overflow-x-hidden overflow-y-auto'
            : 'overflow-hidden',
      )}
    >
      {children}
    </div>
  )
}

function Shot({
  label,
  src,
  name,
  actualSize,
  gallery,
  index,
}: {
  label: string
  src: string | null
  name: string
  actualSize: boolean
  gallery: readonly LightboxImage[]
  index: number
}) {
  return (
    <figure className="flex min-w-0 flex-col gap-1">
      <figcaption className="label-caps">{label}</figcaption>
      {src === null ? (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-4" />
          {label === 'Base' ? 'Not on the base branch' : 'Not captured'}
        </div>
      ) : (
        <Frame actualSize={actualSize}>
          <ZoomableImage
            images={gallery}
            index={index}
            className={actualSize ? 'w-max' : undefined}
          >
            <img
              src={src}
              alt={`${label}: ${name}`}
              className={actualSize ? 'block max-w-none' : 'block h-auto w-full'}
            />
          </ZoomableImage>
        </Frame>
      )}
    </figure>
  )
}

/** Base on the left of the handle, PR on the right. Drag the image or use the slider. */
function SliderCompare({
  base,
  pr,
  name,
  actualSize,
  gallery,
  prIndex,
}: {
  base: string
  pr: string
  name: string
  actualSize: boolean
  gallery: readonly LightboxImage[]
  prIndex: number
}) {
  const [position, setPosition] = useState(50)
  // Clicks on the image move the handle, so full screen gets its own button.
  const lightbox = useLightbox(gallery)

  function fromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    setPosition(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="label-caps flex justify-between">
        <span>Base</span>
        <span>PR</span>
      </div>
      <div className="relative">
        <button
          type="button"
          aria-label="Open full screen"
          title="Open full screen"
          onClick={() => lightbox.open(prIndex)}
          className="absolute top-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-md border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <Expand aria-hidden="true" className="size-3.5" />
        </button>
        <Frame actualSize={actualSize} scroll>
          {/* Both shots share one grid cell, top-anchored at their natural height. */}
          <div
            className={cn(
              'relative grid cursor-ew-resize items-start select-none',
              actualSize ? 'w-max' : 'w-full',
            )}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              fromPointer(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) fromPointer(event)
            }}
          >
            <img
              src={pr}
              alt={`PR: ${name}`}
              draggable={false}
              className={cn(
                'block self-start object-top [grid-area:1/1]',
                actualSize ? 'max-w-none' : 'h-auto w-full',
              )}
            />
            <img
              src={base}
              alt={`Base: ${name}`}
              draggable={false}
              className={cn(
                'block self-start object-top [grid-area:1/1]',
                actualSize ? 'max-w-none' : 'h-auto w-full',
              )}
              style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground/80 shadow-[0_0_0_1px_var(--background)]"
              style={{ left: `${position}%` }}
            />
          </div>
        </Frame>
      </div>
      {lightbox.element}
      <Slider
        aria-label="Base / PR split"
        min={0}
        max={100}
        step={1}
        value={[position]}
        onValueChange={([value]) => (value === undefined ? null : setPosition(value))}
      />
    </div>
  )
}

/** The PR screenshot with the pixel diff laid over it; opacity adjustable. */
function DiffOverlay({
  pr,
  diff,
  name,
  actualSize,
  gallery,
  diffIndex,
}: {
  pr: string
  diff: string
  name: string
  actualSize: boolean
  gallery: readonly LightboxImage[]
  diffIndex: number
}) {
  const [opacity, setOpacity] = useState(70)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="label-caps">PR + diff</span>
        <span className="ml-auto text-xs text-muted-foreground">Overlay</span>
        <Slider
          aria-label="Diff overlay opacity"
          className="w-40"
          min={0}
          max={100}
          step={5}
          value={[opacity]}
          onValueChange={([value]) => (value === undefined ? null : setOpacity(value))}
        />
        <span className="w-9 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {opacity}%
        </span>
      </div>
      <Frame actualSize={actualSize}>
        <ZoomableImage
          images={gallery}
          index={diffIndex}
          className={actualSize ? 'w-max' : undefined}
        >
          <div className={cn('relative', actualSize ? 'w-max' : 'w-full')}>
            <img
              src={pr}
              alt={`PR: ${name}`}
              className={actualSize ? 'block max-w-none' : 'block h-auto w-full'}
            />
            <img
              src={diff}
              alt={`Diff: ${name}`}
              className="absolute inset-0 block size-full object-cover object-top"
              style={{ opacity: opacity / 100 }}
            />
          </div>
        </ZoomableImage>
      </Frame>
    </div>
  )
}

/** Previews booting: the QA station's latest system lines, live. */
function QaBooting({ run, qaRun }: { run: Run; qaRun: QaRun }) {
  const events = useQuery(runQueries.events(run.id))
  const lines = (events.data ?? [])
    .filter(
      (event) =>
        event.stationRunId === qaRun.stationRunId &&
        (event.type === 'system' || event.type === 'error'),
    )
    .slice(-6)
  return (
    <div className="flex flex-col gap-3 p-6" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-status-running" />
        Booting previews…
      </p>
      <p className="text-[0.8125rem] text-muted-foreground">
        Installing and starting the base branch and this branch side by side. Screens appear
        here once both are up.
      </p>
      {lines.length === 0 ? null : (
        <ol className="flex h-36 flex-col justify-end overflow-hidden rounded-md border bg-muted/30 px-2.5 py-2">
          {lines.map((event) => (
            <li
              key={event.id}
              className="flex min-w-0 gap-2 font-mono text-[0.75rem] leading-5 text-muted-foreground"
            >
              <time dateTime={event.createdAt} className="shrink-0 tabular-nums">
                {formatTime(event.createdAt)}
              </time>
              <span
                className={cn('truncate', event.type === 'error' && 'text-status-failed')}
                title={event.message}
              >
                {event.message.split('\n')[0]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function QaError({
  run,
  qaRun,
  onEditPreview,
}: {
  run: Run
  qaRun: QaRun
  onEditPreview: () => void
}) {
  const events = useQuery(runQueries.events(run.id))
  // The station's latest error in this attempt carries the preview's log tail.
  const error = (events.data ?? []).findLast(
    (event) =>
      event.type === 'error' &&
      event.stationRunId === qaRun.stationRunId &&
      Date.parse(event.createdAt) >= Date.parse(qaRun.startedAt),
  )
  const tail = error === undefined ? null : logTail(error.message)
  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-status-failed">
          <CircleX aria-hidden="true" className="size-4" />
          QA couldn&rsquo;t run
        </p>
        <p className="max-w-[72ch] text-[0.8125rem] whitespace-pre-wrap text-muted-foreground">
          {qaRun.summary ?? 'The preview didn’t come up. Check the Activity tab for the log.'}
        </p>
      </div>
      {tail === null ? null : (
        <div className="flex w-full max-w-4xl flex-col gap-1">
          <span className="label-caps">Log tail</span>
          <pre className="max-h-72 scrollbar-thin overflow-auto rounded-md border bg-muted/40 px-2.5 py-2 font-mono text-[0.75rem] leading-relaxed whitespace-pre text-muted-foreground">
            {tail}
          </pre>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onEditPreview}>
        <Settings2 aria-hidden="true" />
        Edit preview settings
      </Button>
    </div>
  )
}
