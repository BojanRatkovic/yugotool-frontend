import { env } from '@/config/env'
import type { QaCheck, QaCheckStatus, QaRun, Station, StationRun } from '@/lib/contracts'

/** Artifact file → API URL. Paths may contain `/`: encode each segment, keep the slashes. */
export function qaFileUrl(runId: string, file: string): string {
  const path = file
    .split('/')
    .filter((segment) => segment !== '')
    .map(encodeURIComponent)
    .join('/')
  return `${env.API_URL}/runs/${runId}/qa/files/${path}`
}

export type QaCounts = Record<QaCheckStatus, number> & { total: number }

export function qaCounts(checks: readonly QaCheck[]): QaCounts {
  const counts: QaCounts = { pass: 0, fail: 0, changed: 0, intended: 0, error: 0, total: 0 }
  for (const check of checks) {
    counts[check.status] += 1
    counts.total += 1
  }
  return counts
}

/** Worst first: what needs a look leads the list. */
const CHECK_STATUS_ORDER: readonly QaCheckStatus[] = [
  'fail',
  'changed',
  'error',
  'intended',
  'pass',
]

/** `7 pass · 1 fail · 2 intended` — zero counts left out. */
export function formatQaCounts(counts: QaCounts): string {
  if (counts.total === 0) return 'No checks yet'
  const parts = (['pass', 'fail', 'changed', 'intended', 'error'] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${status === 'error' ? 'errored' : status}`)
  return parts.join(' · ')
}

export interface CheckGroup {
  status: QaCheckStatus
  checks: QaCheck[]
}

/** Checks grouped by status (fail first), each group in run order. */
export function groupChecks(checks: readonly QaCheck[]): CheckGroup[] {
  return CHECK_STATUS_ORDER.map((status) => ({
    status,
    checks: checks
      .filter((check) => check.status === status)
      .toSorted((a, b) => a.position - b.position),
  })).filter((group) => group.checks.length > 0)
}

/** The check the viewer opens on: an explicit one, else the first that needs a look. */
export function defaultCheck(
  checks: readonly QaCheck[],
  selectedId: string | undefined,
): QaCheck | undefined {
  const explicit = checks.find((check) => check.id === selectedId)
  if (explicit !== undefined) return explicit
  return groupChecks(checks)
    .filter((group) => group.status !== 'pass')
    .flatMap((group) => group.checks)[0]
}

/** True when nothing visual moved (every visual check passed). */
export function noVisualChanges(checks: readonly QaCheck[]): boolean {
  const visual = checks.filter((check) => check.kind === 'visual')
  return visual.length > 0 && visual.every((check) => check.status === 'pass')
}

/** A human may override fail/changed checks only. */
export function canAccept(check: Pick<QaCheck, 'status'>): boolean {
  return check.status === 'fail' || check.status === 'changed'
}

/** QA attempts in order; `attempt` picks one (1-based), else the latest. */
export function selectAttempt(
  runs: readonly QaRun[],
  attempt: number | undefined,
): QaRun | undefined {
  const ordered = runs.toSorted((a, b) => a.attempt - b.attempt)
  return (
    (attempt === undefined ? undefined : ordered.find((run) => run.attempt === attempt)) ??
    ordered.at(-1)
  )
}

/** `QA · 7/9 · 2 diffs` for the stepper; null when the station run has no QA summary. */
export function qaSummaryLine(stationRun: Pick<StationRun, 'qa'>): string | null {
  const qa = stationRun.qa
  if (qa === null) return null
  if (qa.status === 'error') return 'QA · error'
  if (qa.total === 0)
    return qa.status === 'running' ? 'QA · booting previews' : 'QA · no checks'
  const diffs = qa.diffs === 1 ? '1 diff' : `${qa.diffs} diffs`
  return `QA · ${qa.passed}/${qa.total} · ${diffs}`
}

/** Screens with changed pixels across the run's latest QA station attempts. */
type QaStationRun = Pick<StationRun, 'stationKey' | 'attempt' | 'qa'>

export function qaDiffCount(stationRuns: readonly QaStationRun[]): number | null {
  const latest = new Map<string, QaStationRun>()
  for (const sr of stationRuns) {
    if (sr.qa === null) continue
    const prev = latest.get(sr.stationKey)
    if (prev === undefined || sr.attempt >= prev.attempt) latest.set(sr.stationKey, sr)
  }
  if (latest.size === 0) return null
  return [...latest.values()].reduce((sum, sr) => sum + (sr.qa?.diffs ?? 0), 0)
}

export function hasQaStation(stations: readonly Station[]): boolean {
  return stations.some((station) => station.kind === 'qa')
}

/** Console/a11y notes as list items: one per line, bullets stripped. */
export function noteLines(note: string | null): string[] {
  if (note === null) return []
  return note
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((line) => line !== '')
}
