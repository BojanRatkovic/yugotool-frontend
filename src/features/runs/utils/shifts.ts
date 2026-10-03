import type { AnyStatus, Tone } from '@/components/status/status'
import type {
  Handoff,
  Shift,
  ShiftEndReason,
  ShiftStatus,
  ShiftTask,
  Station,
  StationRun,
} from '@/lib/contracts'

/** Percent of the context window in use, unclamped; null when the window is unknown. */
export function contextPct(tokens: number, window: number | null): number | null {
  if (window === null || window <= 0) return null
  return (tokens / window) * 100
}

/** Gauge fill height, 0–100. */
export function gaugeFill(tokens: number, window: number | null): number {
  const pct = contextPct(tokens, window)
  return pct === null ? 0 : Math.min(100, Math.max(0, pct))
}

/** "38%" — whole percent, never "NaN%". */
export function formatPct(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct)}%`
}

/** Shift status on the shared seven-tone scale, plus its word. */
export const SHIFT_STATUS: Record<ShiftStatus, { status: AnyStatus; label: string }> = {
  running: { status: 'running', label: 'Running' },
  handing_off: { status: 'running', label: 'Handing off' },
  awaiting_review: { status: 'awaiting_approval', label: 'Needs review' },
  done: { status: 'succeeded', label: 'Done' },
  failed: { status: 'failed', label: 'Failed' },
  cancelled: { status: 'cancelled', label: 'Cancelled' },
}

export const END_REASON: Record<ShiftEndReason, { label: string; tone: Tone }> = {
  threshold: { label: 'Handoff', tone: 'queued' },
  manual: { label: 'Manual', tone: 'queued' },
  done: { label: 'Goal met', tone: 'passed' },
  stuck: { label: 'Stuck', tone: 'waiting' },
  max_shifts: { label: 'Max shifts', tone: 'waiting' },
  budget: { label: 'Budget', tone: 'failed' },
  error: { label: 'Error', tone: 'failed' },
  cancelled: { label: 'Cancelled', tone: 'cancelled' },
}

/** A shift whose session is live (running or writing its handoff). */
export function isLive(shift: Pick<Shift, 'status'>): boolean {
  return shift.status === 'running' || shift.status === 'handing_off'
}

/** The live shift, if any — the latest one, since only one runs at a time. */
export function liveShift(shifts: readonly Shift[]): Shift | undefined {
  return shifts.findLast(isLive)
}

export function hasShiftStation(stations: readonly Station[]): boolean {
  return stations.some((station) => station.kind === 'shift')
}

/** `Shift 4 · 7/12 tasks · 38%` for the stepper; null for non-shift station runs. */
export function shiftSummary(
  stationRun: Pick<StationRun, 'shift' | 'contextTokens' | 'contextWindow'>,
): string | null {
  const shift = stationRun.shift
  if (shift === null) return null
  const parts = [`Shift ${shift.number}`]
  if (shift.tasksTotal > 0) parts.push(`${shift.tasksDone}/${shift.tasksTotal} tasks`)
  if (shift.status === 'running' || shift.status === 'handing_off') {
    const pct = contextPct(stationRun.contextTokens, stationRun.contextWindow)
    if (pct !== null) parts.push(formatPct(pct))
  }
  return parts.join(' · ')
}

export interface TaskProgress {
  done: number
  total: number
  /** 0–100; 0 when there are no tasks. */
  pct: number
}

export function taskProgress(tasks: readonly Pick<ShiftTask, 'status'>[]): TaskProgress {
  const done = tasks.filter((task) => task.status === 'done').length
  return {
    done,
    total: tasks.length,
    pct: tasks.length === 0 ? 0 : (done / tasks.length) * 100,
  }
}

/** One item per non-empty line — how list fields of the handoff are edited. */
export function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

export function listToLines(items: readonly string[]): string {
  return items.join('\n')
}

/** The editable form of a handoff: lists as newline-separated text. */
export interface HandoffDraft {
  summary: string
  done: string
  inProgress: string
  nextSteps: string
  gotchas: string
  filesToRead: string
}

export function handoffToDraft(handoff: Handoff | null): HandoffDraft {
  return {
    summary: handoff?.summary ?? '',
    done: listToLines(handoff?.done ?? []),
    inProgress: handoff?.inProgress ?? '',
    nextSteps: listToLines(handoff?.nextSteps ?? []),
    gotchas: listToLines(handoff?.gotchas ?? []),
    filesToRead: listToLines(handoff?.filesToRead ?? []),
  }
}

export function draftToHandoff(draft: HandoffDraft): Handoff {
  const inProgress = draft.inProgress.trim()
  return {
    summary: draft.summary.trim(),
    done: linesToList(draft.done),
    inProgress: inProgress === '' ? null : inProgress,
    nextSteps: linesToList(draft.nextSteps),
    gotchas: linesToList(draft.gotchas),
    filesToRead: linesToList(draft.filesToRead),
  }
}
