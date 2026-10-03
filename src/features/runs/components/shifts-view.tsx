import { useQuery, type UseMutationResult } from '@tanstack/react-query'
import {
  Circle,
  CircleCheck,
  CircleDot,
  FastForward,
  GitCommitHorizontal,
  ListChecks,
  OctagonPause,
  Timer,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Cost } from '@/components/cost'
import { LoadError } from '@/components/data-state'
import { TONE_SOFT, TONE_TEXT } from '@/components/status/status'
import { StatusIcon } from '@/components/status/status-chip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  shiftQueries,
  useHandoffNow,
  useStopAfterShift,
} from '@/features/runs/api/shift-queries'
import { HandoffSheet } from '@/features/runs/components/handoff-sheet'
import {
  contextPct,
  END_REASON,
  formatPct,
  gaugeFill,
  isLive,
  liveShift,
  SHIFT_STATUS,
  taskProgress,
} from '@/features/runs/utils/shifts'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { Run, RunMemory, Shift, ShiftTask, Station } from '@/lib/contracts'
import { durationBetween, formatDuration, formatTokens } from '@/lib/format'
import { cn } from '@/lib/utils'

const MEMORY_POLL_MS = 5_000

/** Vertical context gauge: fill to the context used, a red line at the handoff threshold. */
function ContextGauge({ shift }: { shift: Shift }) {
  const fill = gaugeFill(shift.contextTokens, shift.contextWindow)
  const live = isLive(shift)
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <meter> can't be themed consistently across browsers
      role="meter"
      aria-label={`Shift ${shift.number} context, hands off at ${shift.handoffAtPct}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill)}
      className="relative h-28 w-8 overflow-hidden rounded-sm border bg-muted"
    >
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 transition-[height] duration-150',
          // Crossing the line is the normal way a shift ends, so a finished
          // gauge stays neutral; the red line alone marks the threshold.
          live ? 'bg-status-running' : 'bg-muted-foreground/35',
          live && 'animate-pulse-soft',
        )}
        style={{ height: `${fill}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 h-0.5 bg-status-failed"
        style={{ bottom: `calc(${shift.handoffAtPct}% - 1px)` }}
      />
    </div>
  )
}

/** Horizontal context meter with the handoff threshold marked. */
function ContextBar({ shift }: { shift: Shift }) {
  const fill = gaugeFill(shift.contextTokens, shift.contextWindow)
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <meter> can't be themed consistently across browsers
      role="meter"
      aria-label={`Context window, hands off at ${shift.handoffAtPct}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill)}
      className="relative h-2 w-full rounded-full bg-muted"
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-status-running transition-[width] duration-150"
        style={{ width: `${fill}%` }}
      />
      <div
        aria-hidden="true"
        className="absolute -inset-y-1 w-0.5 rounded-full bg-status-failed"
        style={{ left: `calc(${shift.handoffAtPct}% - 1px)` }}
      />
    </div>
  )
}

function EndReasonChip({ shift }: { shift: Shift }) {
  if (shift.endReason === null) {
    const { status, label } = SHIFT_STATUS[shift.status]
    return (
      <span className="inline-flex h-5 items-center gap-1 text-[0.6875rem] font-medium">
        <StatusIcon status={status} className="size-3" />
        {label}
      </span>
    )
  }
  const reason = END_REASON[shift.endReason]
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-1.5 text-[0.6875rem] leading-none font-medium',
        TONE_SOFT[reason.tone],
        TONE_TEXT[reason.tone],
      )}
    >
      {reason.label}
    </span>
  )
}

function ShiftColumn({
  shift,
  run,
  selected,
  onSelect,
}: {
  shift: Shift
  run: Run
  selected: boolean
  onSelect: () => void
}) {
  const pct = contextPct(shift.contextTokens, shift.contextWindow)
  const authSource = run.stations.find((sr) => sr.id === shift.stationRunId)?.authSource
  const { status, label } = SHIFT_STATUS[shift.status]
  return (
    <li className="shrink-0">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Shift ${shift.number}, ${label}`}
        onClick={onSelect}
        className={cn(
          'flex w-28 flex-col items-center gap-2 rounded-md border px-2 py-2.5 transition-colors',
          selected ? 'border-foreground/25 bg-accent' : 'bg-card hover:bg-accent/60',
        )}
      >
        <span className="flex w-full items-center justify-between">
          <span className="font-mono text-xs font-medium tabular-nums">#{shift.number}</span>
          <StatusIcon status={status} />
        </span>
        <ContextGauge shift={shift} />
        <span className="font-mono text-xs tabular-nums">{formatPct(pct)}</span>
        <dl className="grid w-full grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          <dt>
            <Timer aria-hidden="true" className="size-3" />
            <span className="sr-only">Duration</span>
          </dt>
          <dd className="text-right">
            {formatDuration(durationBetween(shift.startedAt, shift.finishedAt))}
          </dd>
          <dt>
            <GitCommitHorizontal aria-hidden="true" className="size-3" />
            <span className="sr-only">Commits</span>
          </dt>
          <dd className="text-right">{shift.commits}</dd>
          <dt>
            <ListChecks aria-hidden="true" className="size-3" />
            <span className="sr-only">Tasks done</span>
          </dt>
          <dd className="text-right">
            {shift.tasksTotal === 0 ? '—' : `${shift.tasksDone}/${shift.tasksTotal}`}
          </dd>
          <dt className="sr-only">Cost</dt>
          <dd className="col-span-2 text-right">
            <Cost usd={shift.costUsd} authSource={authSource} plain />
          </dd>
        </dl>
        <EndReasonChip shift={shift} />
      </button>
    </li>
  )
}

const TASK_ICON = {
  done: <CircleCheck aria-hidden="true" className="size-3.5 shrink-0 text-status-passed" />,
  doing: <CircleDot aria-hidden="true" className="size-3.5 shrink-0 text-status-running" />,
  todo: <Circle aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />,
} as const

const TASK_WORD = { done: 'done', doing: 'in progress', todo: 'to do' } as const

function TaskList({ tasks }: { tasks: ShiftTask[] }) {
  const progress = taskProgress(tasks)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Tasks</span>
        <div
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- native <progress> can't be themed consistently
          role="progressbar"
          aria-label="Tasks done"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-status-passed transition-[width] duration-150"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
        <span className="font-mono text-xs tabular-nums">
          {progress.done}/{progress.total}
        </span>
      </div>
      <ul className="grid max-h-56 scrollbar-thin grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto xl:grid-cols-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex min-w-0 items-start gap-2 text-[0.8125rem]"
            title={task.notes ?? undefined}
          >
            <span className="mt-[3px]">{TASK_ICON[task.status]}</span>
            <span
              className={cn(
                'min-w-0 break-words',
                task.status === 'done' && 'text-muted-foreground line-through',
              )}
            >
              {task.title}
              <span className="sr-only"> — {TASK_WORD[task.status]}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function memoryErrorText(error: unknown): string {
  if (error instanceof ApiError && error.code === 'workspace_gone') {
    return 'The worktree was cleaned up, so the run’s memory is no longer available.'
  }
  return errorMessage(error)
}

function ControlButton({
  pressed,
  pressedLabel,
  label,
  icon,
  mutation,
  doneToast,
}: {
  pressed: boolean
  pressedLabel: string
  label: string
  icon: React.ReactNode
  mutation: UseMutationResult<unknown, Error, undefined>
  doneToast: string
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      aria-pressed={pressed}
      disabled={pressed || mutation.isPending}
      className={cn(pressed && 'border-foreground/25 bg-accent disabled:opacity-100')}
      onClick={() =>
        mutation.mutate(undefined, {
          onSuccess: () => toast.success(doneToast),
          onError: (error) => toast.error(`${label} failed: ${errorMessage(error)}`),
        })
      }
    >
      {icon}
      {pressed ? pressedLabel : label}
    </Button>
  )
}

/** The running shift: context against the threshold, tasks, and the two brakes. */
function LiveStrip({
  run,
  shift,
  memory,
}: {
  run: Run
  shift: Shift
  memory: { data: RunMemory | undefined; error: unknown; isPending: boolean }
}) {
  const handoffNow = useHandoffNow(run.id)
  const stopAfter = useStopAfterShift(run.id)
  const pct = contextPct(shift.contextTokens, shift.contextWindow)
  const { status, label } = SHIFT_STATUS[shift.status]
  return (
    <section
      aria-label={`Shift ${shift.number}, live`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StatusIcon status={status} />
          Shift {shift.number}
          <span className="font-normal text-muted-foreground">· {label}</span>
        </h3>
        <div className="ml-auto flex gap-2">
          <ControlButton
            pressed={shift.handoffRequested || shift.status === 'handing_off'}
            pressedLabel="Handoff requested"
            label="Handoff now"
            icon={<FastForward aria-hidden="true" />}
            mutation={handoffNow}
            doneToast={`Shift ${shift.number} hands off at the next turn boundary.`}
          />
          <ControlButton
            pressed={shift.stopAfter}
            pressedLabel="Stops after this shift"
            label="Stop after this shift"
            icon={<OctagonPause aria-hidden="true" />}
            mutation={stopAfter}
            doneToast={`The station stops after shift ${shift.number}.`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Context</span>
          <span className="font-mono tabular-nums">
            {formatTokens(shift.contextTokens)}
            {shift.contextWindow === null
              ? null
              : ` / ${formatTokens(shift.contextWindow)}`} ·{' '}
            <span className="text-foreground">{formatPct(pct)}</span> · hands off at{' '}
            <span className="text-status-failed">{shift.handoffAtPct}%</span>
          </span>
        </div>
        <ContextBar shift={shift} />
      </div>
      {memory.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : memory.data === undefined ? (
        <p className="text-xs text-muted-foreground">{memoryErrorText(memory.error)}</p>
      ) : memory.data.tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No task list yet — the first shift writes{' '}
          <span className="font-mono">tasks.json</span> from the goal.
        </p>
      ) : (
        <TaskList tasks={memory.data.tasks} />
      )}
    </section>
  )
}

function MemoryBlock({
  title,
  text,
  mono = false,
}: {
  title: string
  text: string | null
  mono?: boolean
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="label-caps">{title}</h3>
      {text === null || text.trim() === '' ? (
        <p className="text-[0.8125rem] text-muted-foreground">Nothing yet.</p>
      ) : (
        <div
          className={cn(
            'max-h-96 scrollbar-thin overflow-y-auto rounded-md border bg-card px-3 py-2.5 leading-relaxed break-words whitespace-pre-wrap',
            mono ? 'font-mono text-xs' : 'text-[0.8125rem]',
          )}
        >
          {text}
        </div>
      )}
    </section>
  )
}

function MemoryView({
  memory,
}: {
  memory: { data: RunMemory | undefined; error: unknown; isPending: boolean }
}) {
  if (memory.isPending) return <Skeleton className="h-40 w-full" />
  if (memory.data === undefined) {
    return (
      <p className="text-[0.8125rem] text-muted-foreground">{memoryErrorText(memory.error)}</p>
    )
  }
  const { goal, tasks, progress, learnings } = memory.data
  return (
    <div className="flex flex-col gap-4">
      <MemoryBlock title="Goal · goal.md" text={goal} />
      <section aria-label="Tasks" className="flex flex-col gap-1.5">
        <h3 className="label-caps">Tasks · tasks.json</h3>
        {tasks.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">Nothing yet.</p>
        ) : (
          <TaskList tasks={tasks} />
        )}
      </section>
      <MemoryBlock title="Progress · progress.md" text={progress} mono />
      <MemoryBlock title="Learnings · learnings.md" text={learnings} mono />
    </div>
  )
}

function ShiftsSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-busy="true">
      <Skeleton className="h-28 w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-28" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

type Detail = 'handoff' | 'memory'

/**
 * The Shifts tab: live strip for the running shift, a timeline with one
 * column per shift, and the selected shift's handoff (or the run's memory).
 * `selectedShift` (a shift number) lives in the URL.
 */
export function ShiftsView({
  run,
  stations,
  selectedShift,
  onSelectShift,
}: {
  run: Run
  stations: Station[]
  selectedShift: number | undefined
  onSelectShift: (number: number | undefined) => void
}) {
  const [detail, setDetail] = useState<Detail>('handoff')
  const shifts = useQuery(shiftQueries.list(run.id))
  const live = shifts.data === undefined ? undefined : liveShift(shifts.data)
  const memory = useQuery({
    ...shiftQueries.memory(run.id),
    enabled: (shifts.data?.length ?? 0) > 0,
    refetchInterval: live === undefined ? false : MEMORY_POLL_MS,
  })
  const memoryState = { data: memory.data, error: memory.error, isPending: memory.isPending }

  if (shifts.isPending) return <ShiftsSkeleton />
  if (shifts.isError) {
    return (
      <div className="p-4">
        <LoadError what="shifts" message={errorMessage(shifts.error)} />
      </div>
    )
  }

  const list = shifts.data
  if (list.length === 0) {
    const names = stations.filter((s) => s.kind === 'shift').map((s) => s.name)
    return (
      <div className="flex flex-col items-start gap-1 p-6">
        <p className="text-sm font-medium">No shifts yet</p>
        <p className="max-w-prose text-[0.8125rem] text-muted-foreground">
          Shifts appear when the run reaches {names.length === 1 ? names[0] : 'a shift station'}
          . Each one hands off to a fresh session when its context crosses the threshold.
        </p>
      </div>
    )
  }

  // Default selection: the latest shift that left a handoff, else the latest.
  const selected =
    list.find((shift) => shift.number === selectedShift) ??
    list.findLast((shift) => shift.handoff !== null) ??
    list.at(-1)
  const multipleStations = new Set(list.map((shift) => shift.stationKey)).size > 1
  const stationName = (key: string) => stations.find((s) => s.key === key)?.name ?? key

  return (
    <div className="flex flex-col gap-4 p-4">
      {live === undefined ? null : <LiveStrip run={run} shift={live} memory={memoryState} />}

      <section aria-label="Shift timeline" className="flex flex-col gap-2">
        <h3 className="label-caps">
          Timeline · {list.length} {list.length === 1 ? 'shift' : 'shifts'}
        </h3>
        <ol className="flex scrollbar-thin gap-2 overflow-x-auto pb-1">
          {list.map((shift, index) => (
            <ShiftTimelineItem
              key={shift.id}
              shift={shift}
              run={run}
              label={
                multipleStations && list[index - 1]?.stationKey !== shift.stationKey
                  ? stationName(shift.stationKey)
                  : null
              }
              selected={selected?.id === shift.id}
              onSelect={() => onSelectShift(shift.number)}
            />
          ))}
        </ol>
      </section>

      <section aria-label="Shift details" className="flex flex-col gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={detail}
          onValueChange={(value) =>
            value === 'memory' || value === 'handoff' ? setDetail(value) : null
          }
          aria-label="Show"
          className="self-start"
        >
          <ToggleGroupItem value="handoff" className="text-xs">
            Handoff
          </ToggleGroupItem>
          <ToggleGroupItem value="memory" className="text-xs">
            Memory
          </ToggleGroupItem>
        </ToggleGroup>
        {detail === 'memory' ? (
          <MemoryView memory={memoryState} />
        ) : selected === undefined ? null : (
          <HandoffSheet shift={selected} />
        )}
      </section>
    </div>
  )
}

function ShiftTimelineItem({
  label,
  ...props
}: {
  shift: Shift
  run: Run
  label: string | null
  selected: boolean
  onSelect: () => void
}) {
  if (label === null) return <ShiftColumn {...props} />
  return (
    <>
      <li aria-hidden="true" className="flex shrink-0 items-start pt-2.5">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground [writing-mode:vertical-rl]">
          {label}
        </span>
      </li>
      <ShiftColumn {...props} />
    </>
  )
}
