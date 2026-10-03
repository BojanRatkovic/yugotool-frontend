import type { AnyStatus } from '@/components/status/status'
import {
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

/** The line's stations plus "Repo hooks" before the last gate, when `run` ran the preflight. */
export function runSteps(stations: Station[], run: Run | undefined): Station[] {
  const ranHooks = run?.stations.some((sr) => sr.stationKey === REPO_HOOKS_STATION_KEY) ?? false
  if (!ranHooks || stations.some((station) => station.key === REPO_HOOKS_STATION_KEY)) {
    return stations
  }
  const gate = stations.findLastIndex((station) => station.kind === 'gate')
  const at = gate < 0 ? stations.length : gate
  return [...stations.slice(0, at), REPO_HOOKS_STATION, ...stations.slice(at)]
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
    const status: AnyStatus =
      stationRun?.status ?? (run === undefined ? 'queued' : finished ? 'skipped' : 'queued')
    return { station, stationRun, attempts: attempts.length, status }
  })
}
