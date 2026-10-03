import { Cost } from '@/components/cost'
import { Meter } from '@/components/meter'
import { runsSessions } from '@/components/station-icon'
import type { StationState } from '@/features/runs/utils/station-states'
import type { AuthSource, Run } from '@/lib/contracts'
import { formatTokens, formatUsd } from '@/lib/format'

/** The run's auth: subscription if any agent session billed against it. */
export function runAuthSource(run: Run | undefined): AuthSource | null {
  const sources = (run?.stations ?? []).map((sr) => sr.authSource)
  if (sources.includes('subscription')) return 'subscription'
  if (sources.includes('api_key')) return 'api_key'
  return null
}

/** Right-rail "Cost & context": run total, budget, per-agent cost and context window. */
export function RunUsage({
  run,
  states,
  maxBudgetUsd,
}: {
  run: Run
  states: StationState[]
  maxBudgetUsd: number | null
}) {
  const auth = runAuthSource(run)
  const agents = states.filter((state) => runsSessions(state.station.kind))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.8125rem] text-muted-foreground">This run</span>
        <Cost usd={run.costUsd} authSource={auth} className="text-sm font-medium" />
      </div>
      {maxBudgetUsd === null ? null : (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Budget</span>
            <span className="font-mono tabular-nums">
              {formatUsd(run.costUsd)} / {formatUsd(maxBudgetUsd)}
            </span>
          </div>
          <Meter
            value={run.costUsd}
            max={maxBudgetUsd}
            label="Budget used"
            warnAt={70}
            failAt={90}
          />
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {agents.map(({ station, stationRun }) => {
          const hasContext =
            stationRun !== undefined &&
            stationRun.contextWindow !== null &&
            stationRun.contextTokens > 0
          return (
            <li key={station.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate">{station.name}</span>
                {stationRun === undefined ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Cost usd={stationRun.costUsd} authSource={stationRun.authSource} />
                )}
              </div>
              {hasContext && stationRun.contextWindow !== null ? (
                <div className="flex items-center gap-2">
                  <Meter
                    value={stationRun.contextTokens}
                    max={stationRun.contextWindow}
                    warnAt={80}
                    failAt={95}
                    label={`${station.name} context window`}
                  />
                  <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                    {formatTokens(stationRun.contextTokens)} /{' '}
                    {formatTokens(stationRun.contextWindow)}
                  </span>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
