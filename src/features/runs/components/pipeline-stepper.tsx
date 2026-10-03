import { Cost } from '@/components/cost'
import { modelLabel } from '@/components/model-select'
import { runsSessions, StationIcon } from '@/components/station-icon'
import { STATUS_LABEL, TONE, TONE_BG } from '@/components/status/status'
import { StatusIcon } from '@/components/status/status-chip'
import { qaSummaryLine } from '@/features/runs/utils/qa'
import { shiftSummary } from '@/features/runs/utils/shifts'
import type { StationState } from '@/features/runs/utils/station-states'
import {
  CI_STATION_KEY,
  REPO_HOOKS_STATION_KEY,
  type Effort,
  type Station,
  type StationRun,
} from '@/lib/contracts'
import { durationBetween, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Third line of a step: the one detail that identifies the station (shift
 * progress, model, command). Always present so every step has the same height.
 */
/** The work order's model/effort overrides; they win over the line's settings, as in the worker. */
export interface RunOverrides {
  model: string | null
  effort: Effort | null
}

export function detailLine(
  station: Station,
  stationRun: StationRun | undefined,
  overrides: RunOverrides = { model: null, effort: null },
): string {
  if (station.key === REPO_HOOKS_STATION_KEY) {
    // A failed hook: the last line of what it printed says why.
    const why = stationRun?.status === 'failed' ? (stationRun.error ?? stationRun.output) : null
    const last = why
      ?.split('\n')
      .map((line) => line.trim())
      .findLast((line) => line !== '')
    return last ?? 'pre-commit'
  }
  if (station.key === CI_STATION_KEY) return stationRun?.output ?? 'Waiting for CI to report'
  if (station.kind === 'gate') return 'Human review'
  if (station.kind === 'checks') return station.command
  if (station.kind === 'qa') {
    const qa = stationRun === undefined ? null : qaSummaryLine(stationRun)
    return qa ?? `QA · ${station.viewports.join(', ')} · ${station.themes.join(', ')}`
  }
  const shift = stationRun === undefined ? null : shiftSummary(stationRun)
  if (shift !== null) return shift
  const model = modelLabel(stationRun?.model ?? overrides.model ?? station.model)
  const stationEffort = overrides.effort ?? station.effort
  const effort = stationEffort === undefined ? '' : ` · ${stationEffort}`
  if (station.kind === 'shift') return `${model} · hands off ${station.handoffAtPct}%`
  return `${model}${effort}`
}

/**
 * The line as connected steps. Every step has a fixed size (three fixed-height
 * lines, truncated, tabular numbers) so the panel never jumps as a run moves. Clicking a step filters the activity feed to
 * that station; clicking the selected one clears the filter.
 */
export function PipelineStepper({
  states,
  selectedKey,
  onSelect,
  overrides,
}: {
  states: StationState[]
  selectedKey: string | undefined
  onSelect: (key: string | undefined) => void
  overrides?: RunOverrides
}) {
  return (
    <ol
      aria-label="Pipeline"
      className="flex scrollbar-thin items-stretch overflow-x-auto px-4 py-3"
    >
      {states.map(({ station, stationRun, status, attempts }, index) => {
        const selected = selectedKey === station.key
        const reached = stationRun !== undefined
        const detail = detailLine(station, stationRun, overrides)
        return (
          <li key={station.key} className="flex min-w-0 shrink-0 items-center">
            {index === 0 ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px w-4 shrink-0',
                  reached ? TONE_BG[TONE[status]] : 'bg-border',
                  reached && 'opacity-60',
                )}
              />
            )}
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? undefined : station.key)}
              className={cn(
                'flex h-[4.75rem] w-48 flex-col justify-between overflow-hidden rounded-md border px-2.5 py-2 text-left transition-colors',
                selected
                  ? 'border-foreground/25 bg-accent'
                  : 'border-border bg-card hover:bg-accent/60',
                !reached && 'opacity-70',
              )}
            >
              <span className="flex h-5 min-w-0 items-center gap-1.5">
                <StationIcon
                  kind={station.kind}
                  stationKey={station.key}
                  className="text-muted-foreground"
                />
                <span
                  className="min-w-0 flex-1 truncate text-[0.8125rem] leading-5 font-medium"
                  title={station.name}
                >
                  {station.name}
                </span>
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  <StatusIcon status={status} label={STATUS_LABEL[status]} />
                </span>
              </span>
              <span className="flex h-4 min-w-0 items-center gap-2 overflow-hidden font-mono text-[0.6875rem] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                {stationRun === undefined ? (
                  <span>{STATUS_LABEL[status]}</span>
                ) : (
                  <>
                    <span>
                      {formatDuration(
                        durationBetween(stationRun.startedAt, stationRun.finishedAt),
                      )}
                    </span>
                    {runsSessions(station.kind) ? (
                      <Cost usd={stationRun.costUsd} authSource={stationRun.authSource} plain />
                    ) : null}
                    {attempts > 1 ? <span>×{attempts}</span> : null}
                  </>
                )}
              </span>
              <span
                className={cn(
                  'block h-4 truncate font-mono text-[0.6875rem] leading-4 tabular-nums',
                  status === 'failed' &&
                    (station.key === REPO_HOOKS_STATION_KEY || station.key === CI_STATION_KEY)
                    ? 'text-status-failed'
                    : (station.kind === 'shift' || station.kind === 'qa') && reached
                      ? 'text-foreground/80'
                      : 'text-muted-foreground',
                )}
                title={detail}
              >
                {detail}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
