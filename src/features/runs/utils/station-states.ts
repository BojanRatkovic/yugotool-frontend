import type { AnyStatus } from '@/components/status/status'
import {
  CI_STATION_KEY,
  REPO_HOOKS_STATION_KEY,
  type Run,
  type Station,
  type StationRun,
} from '@/lib/contracts'

export interface StationState {
  station: Station
  /** Latest attempt at this station in the run, if it got there. */
  stationRun: StationRun | undefined
  attempts: number
  status: AnyStatus
}

/**
 * The repo's pre-commit preflight drawn as a step. Not a line station — the
 * worker adds it when the repo has a hook — so it is synthesized here.
 */
export const REPO_HOOKS_STATION: Extract<Station, { kind: 'checks' }> = {
  key: REPO_HOOKS_STATION_KEY,
  kind: 'checks',
  name: 'Repo hooks',
  command: 'pre-commit',
}

/** The PR's CI after delivery, drawn as the last step. Synthesized like repo hooks. */
export const CI_STATION: Extract<Station, { kind: 'checks' }> = {
  key: CI_STATION_KEY,
  kind: 'checks',
  name: 'CI',
  command: 'gh pr checks',
}

const ran = (run: Run | undefined, key: string): boolean =>
  run?.stations.some((sr) => sr.stationKey === key) ?? false

/**
 * The line's stations plus the steps the worker adds: "Repo hooks" before the
 * last gate when `run` ran the preflight, "CI" at the end when it watched CI.
 */
function runSteps(stations: Station[], run: Run | undefined): Station[] {
  let steps = stations
  if (
    ran(run, REPO_HOOKS_STATION_KEY) &&
    !steps.some((s) => s.key === REPO_HOOKS_STATION_KEY)
  ) {
    const gate = steps.findLastIndex((station) => station.kind === 'gate')
    const at = gate < 0 ? steps.length : gate
    steps = [...steps.slice(0, at), REPO_HOOKS_STATION, ...steps.slice(at)]
  }
  if (ran(run, CI_STATION_KEY) && !steps.some((s) => s.key === CI_STATION_KEY)) {
    steps = [...steps, CI_STATION]
  }
  return steps
}

/**
 * One entry per step (line stations in order, plus "Repo hooks" when the run
 * had it), with that step's latest status in `run`.
 */
export function stationStates(stations: Station[], run: Run | undefined): StationState[] {
  const finished =
    run !== undefined && run.status !== 'running' && run.status !== 'awaiting_approval'
  return runSteps(stations, run).map((station) => {
    const attempts = (run?.stations ?? [])
      .filter((sr) => sr.stationKey === station.key)
      .toSorted((a, b) => a.attempt - b.attempt || a.startedAt.localeCompare(b.startedAt))
    const stationRun = attempts.at(-1)
    // CI that reported nothing (no CI, timed out) is recorded as cancelled; it is not a stop.
    const ciSkipped = station.key === CI_STATION_KEY && stationRun?.status === 'cancelled'
    const status: AnyStatus = ciSkipped
      ? 'skipped'
      : (stationRun?.status ?? (run === undefined ? 'queued' : finished ? 'skipped' : 'queued'))
    return { station, stationRun, attempts: attempts.length, status }
  })
}
