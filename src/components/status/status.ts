import type { RunStatus, StationRunStatus, WorkOrderStatus } from '@/lib/contracts'

/** The seven visual states. Every domain status maps onto exactly one. */
export type Tone =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'waiting'
  | 'cancelled'
  | 'skipped'

/** Domain statuses plus `queued` (a station the run hasn't reached) and `skipped`. */
export type AnyStatus = WorkOrderStatus | RunStatus | StationRunStatus | 'queued' | 'skipped'

export const TONE: Record<AnyStatus, Tone> = {
  backlog: 'queued',
  queued: 'queued',
  running: 'running',
  awaiting_approval: 'waiting',
  changes_requested: 'waiting',
  done: 'passed',
  succeeded: 'passed',
  failed: 'failed',
  rejected: 'failed',
  cancelled: 'cancelled',
  skipped: 'skipped',
}

export const STATUS_LABEL: Record<AnyStatus, string> = {
  backlog: 'Backlog',
  queued: 'Queued',
  running: 'Running',
  awaiting_approval: 'Needs you',
  changes_requested: 'Changes requested',
  done: 'Done',
  succeeded: 'Passed',
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
}

/** Text color per tone — static strings so Tailwind sees them. */
export const TONE_TEXT: Record<Tone, string> = {
  queued: 'text-status-queued',
  running: 'text-status-running',
  passed: 'text-status-passed',
  failed: 'text-status-failed',
  waiting: 'text-status-waiting',
  cancelled: 'text-status-cancelled',
  skipped: 'text-status-skipped',
}

export const TONE_SOFT: Record<Tone, string> = {
  queued: 'bg-status-queued-soft',
  running: 'bg-status-running-soft',
  passed: 'bg-status-passed-soft',
  failed: 'bg-status-failed-soft',
  waiting: 'bg-status-waiting-soft',
  cancelled: 'bg-status-cancelled-soft',
  skipped: 'bg-status-skipped-soft',
}

export const TONE_BG: Record<Tone, string> = {
  queued: 'bg-status-queued',
  running: 'bg-status-running',
  passed: 'bg-status-passed',
  failed: 'bg-status-failed',
  waiting: 'bg-status-waiting',
  cancelled: 'bg-status-cancelled',
  skipped: 'bg-status-skipped',
}

export const TONE_BORDER: Record<Tone, string> = {
  queued: 'border-status-queued',
  running: 'border-status-running',
  passed: 'border-status-passed',
  failed: 'border-status-failed',
  waiting: 'border-status-waiting',
  cancelled: 'border-status-cancelled',
  skipped: 'border-status-skipped',
}
