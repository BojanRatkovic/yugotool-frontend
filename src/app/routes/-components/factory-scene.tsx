import { ArrowRight, Check, FolderGit2, GitPullRequestArrow, Inbox } from 'lucide-react'
import { useEffect, useState } from 'react'

import { BranchChip } from '@/components/branch-chip'
import { StationIcon } from '@/components/station-icon'
import { StatusIcon } from '@/components/status/status-chip'
import { TONE, TONE_BG, type AnyStatus } from '@/components/status/status'
import type { Station } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** Which part of the factory the tour is explaining. */
export type SceneFocus = 'project' | 'line' | 'work-order' | 'run'

const STATIONS: readonly { name: string; kind: Station['kind'] }[] = [
  { name: 'Build', kind: 'agent' },
  { name: 'Checks', kind: 'checks' },
  { name: 'QA', kind: 'qa' },
  { name: 'Review', kind: 'gate' },
]

/** Backlog + stations + Done: the token's column. */
const COLUMNS = STATIONS.length + 2
const GATE = STATIONS.length - 1

/**
 * One loop of a run, one tick each: build, checks, QA, then the gate holds
 * for a while before the approval lands and the work order reaches Done.
 */
const RUN_TICKS = 13
const TICK_MS = 850

interface RunFrame {
  /** Column the work order sits in (0 = Backlog, COLUMNS - 1 = Done). */
  column: number
  /** Index of the station working right now; -1 before, STATIONS.length after. */
  active: number
  waiting: boolean
  approving: boolean
}

function runFrame(tick: number): RunFrame {
  if (tick === 0) return { column: 0, active: -1, waiting: false, approving: false }
  if (tick <= 2) return { column: 1, active: 0, waiting: false, approving: false }
  if (tick === 3) return { column: 2, active: 1, waiting: false, approving: false }
  if (tick === 4) return { column: 3, active: 2, waiting: false, approving: false }
  if (tick <= 9) return { column: 4, active: GATE, waiting: true, approving: tick === 9 }
  return { column: COLUMNS - 1, active: STATIONS.length, waiting: false, approving: false }
}

const IDLE: RunFrame = { column: 0, active: -1, waiting: false, approving: false }

function useRunTicker(playing: boolean): RunFrame {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!playing) return undefined
    const id = window.setInterval(() => setTick((value) => (value + 1) % RUN_TICKS), TICK_MS)
    return () => {
      window.clearInterval(id)
      setTick(0)
    }
  }, [playing])
  return playing ? runFrame(tick) : IDLE
}

function stationStatus(index: number, frame: RunFrame): AnyStatus {
  if (index < frame.active) return 'succeeded'
  if (index === frame.active) return frame.waiting ? 'awaiting_approval' : 'running'
  return 'queued'
}

/** Dims whatever the current step isn't about. */
function dim(on: boolean) {
  return cn('transition-opacity duration-500', on ? 'opacity-100' : 'opacity-30')
}

function Node({
  children,
  highlight,
  waiting,
}: {
  children: React.ReactNode
  highlight: boolean
  waiting?: boolean
}) {
  return (
    <div
      className={cn(
        'flex h-9 w-full items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-medium transition-[border-color,box-shadow] duration-500',
        highlight && 'border-foreground/25',
        waiting && 'border-status-waiting shadow-[0_0_0_3px] shadow-status-waiting/20',
      )}
    >
      {children}
    </div>
  )
}

function Connector({ flowing }: { flowing: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'h-px w-3 shrink-0 bg-border transition-colors duration-500',
        flowing && 'bg-foreground/40',
      )}
    />
  )
}

function WorkOrderToken({ frame, running }: { frame: RunFrame; running: boolean }) {
  const done = frame.column === COLUMNS - 1
  const status: AnyStatus = done
    ? 'done'
    : frame.waiting
      ? 'awaiting_approval'
      : running && frame.active >= 0
        ? 'running'
        : 'backlog'
  return (
    <div
      className="absolute top-0 w-40 -translate-x-1/2 transition-[left] duration-700 ease-[cubic-bezier(0.2,0,0,1)]"
      style={{ left: `${((frame.column + 0.5) / COLUMNS) * 100}%` }}
    >
      <div
        className={cn(
          'relative flex flex-col gap-1.5 overflow-hidden rounded-md border bg-card px-2.5 py-2 shadow-lg shadow-black/20',
          frame.waiting && 'border-status-waiting/60',
        )}
      >
        {frame.waiting ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-status-waiting"
          />
        ) : null}
        <span className="truncate text-[0.6875rem] font-medium">Add dark mode toggle</span>
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[0.625rem] text-muted-foreground">
            <StatusIcon status={status} className="size-3" />
            {status === 'awaiting_approval'
              ? 'Needs you'
              : status === 'backlog'
                ? 'Backlog'
                : done
                  ? 'Done'
                  : 'Running'}
          </span>
          {done ? (
            <GitPullRequestArrow aria-hidden="true" className="size-3 text-status-passed" />
          ) : null}
        </span>
        {/* Pipeline strip: one segment per station, colored by its latest status. */}
        <span className="flex gap-0.5">
          {STATIONS.map((station, index) => (
            <span
              key={station.name}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-500',
                running ? TONE_BG[TONE[stationStatus(index, frame)]] : 'bg-muted',
              )}
            />
          ))}
        </span>
      </div>
    </div>
  )
}

function GateCard({ frame }: { frame: RunFrame }) {
  return (
    <div
      className={cn(
        'absolute top-0 right-[calc(25%+5.75rem)] w-60 rounded-md border border-status-waiting/40 bg-status-waiting-soft p-2.5 transition-opacity duration-500',
        frame.waiting ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-status-waiting">
        <StatusIcon status="awaiting_approval" className="size-3" />
        Review · waiting for you
      </p>
      <p className="mt-1 text-[0.6875rem] text-muted-foreground">
        Toggle works in both themes. Merge it?
      </p>
      <div className="mt-2 flex justify-end gap-1.5">
        <span className="rounded-sm border px-2 py-0.5 text-[0.625rem] text-muted-foreground">
          Reject
        </span>
        <span
          className={cn(
            'flex items-center gap-1 rounded-sm bg-primary px-2 py-0.5 text-[0.625rem] font-medium text-primary-foreground transition-transform duration-200',
            frame.approving && 'scale-95 ring-2 ring-status-waiting/60',
          )}
        >
          <Check aria-hidden="true" className="size-2.5" />
          Approve
        </span>
      </div>
    </div>
  )
}

/**
 * A miniature factory floor: a project, its line, one work order and a run
 * that stops at the gate. The tour steps light up the part they explain.
 */
export function FactoryScene({ focus }: { focus: SceneFocus }) {
  const running = focus === 'run'
  const frame = useRunTicker(running)
  const showToken = focus === 'work-order' || running

  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-5 px-6 pt-14 pb-6 select-none">
      <div className={cn('flex items-center gap-2', dim(focus === 'project'))}>
        <span className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
          <FolderGit2 className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">acme-web</span>
          <BranchChip branch="main" />
        </span>
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          ~/code/acme-web
        </span>
      </div>

      <div className={cn('flex items-center', dim(focus === 'line' || running))}>
        <div className={cn('min-w-0 flex-1', focus === 'work-order' && 'opacity-100!')}>
          <Node highlight={focus === 'work-order'}>
            <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">Backlog</span>
            <span className="ml-auto font-mono text-[0.625rem] text-muted-foreground">3</span>
          </Node>
        </div>
        {STATIONS.map((station, index) => {
          const status = running ? stationStatus(index, frame) : 'queued'
          return (
            <div key={station.name} className="flex min-w-0 flex-1 items-center">
              <Connector flowing={running && index <= frame.active} />
              <Node highlight={focus === 'line'} waiting={status === 'awaiting_approval'}>
                <StationIcon kind={station.kind} className="text-muted-foreground" />
                <span className="truncate">{station.name}</span>
                <StatusIcon status={status} className="ml-auto size-3" />
              </Node>
            </div>
          )
        })}
        <div className="flex min-w-0 flex-1 items-center">
          <Connector flowing={running && frame.active >= STATIONS.length} />
          <Node highlight={false}>
            <StatusIcon status={running && frame.column === COLUMNS - 1 ? 'done' : 'queued'} />
            <span className="truncate">Done</span>
          </Node>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className={dim(showToken)}>
          <WorkOrderToken frame={frame} running={running} />
        </div>
        {running ? <GateCard frame={frame} /> : null}
        {focus === 'work-order' ? (
          <span className="absolute top-20 left-[calc(100%/12)] flex -translate-x-1/2 items-center gap-1 text-[0.625rem] text-muted-foreground">
            Start <ArrowRight className="size-3" />
          </span>
        ) : null}
      </div>
    </div>
  )
}
