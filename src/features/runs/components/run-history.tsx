import { StatusIcon } from '@/components/status/status-chip'
import { STATUS_LABEL } from '@/components/status/status'
import { Cost } from '@/components/cost'
import { runAuthSource } from '@/features/runs/components/run-usage'
import type { Run } from '@/lib/contracts'
import { durationBetween, formatDateTime, formatDuration, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Every run of the work order, newest first. Click to view one. */
export function RunHistory({
  runs,
  selectedId,
  onSelect,
}: {
  runs: Run[]
  selectedId: string | undefined
  onSelect: (runId: string) => void
}) {
  const sorted = runs.toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
  if (sorted.length === 0) {
    return <p className="text-xs text-muted-foreground">No runs yet.</p>
  }
  return (
    <ol className="-mx-2 flex flex-col">
      {sorted.map((run, index) => (
        <li key={run.id}>
          <button
            type="button"
            aria-current={run.id === selectedId ? 'true' : undefined}
            onClick={() => onSelect(run.id)}
            className={cn(
              'grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1.5 text-left hover:bg-accent',
              run.id === selectedId && 'bg-accent',
            )}
          >
            <StatusIcon status={run.status} label={STATUS_LABEL[run.status]} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-xs">
                Run {sorted.length - index}
                <span className="text-muted-foreground"> · {STATUS_LABEL[run.status]}</span>
              </span>
              <span
                className="truncate font-mono text-[0.6875rem] text-muted-foreground"
                title={formatDateTime(run.startedAt)}
              >
                {formatRelative(run.startedAt)} ·{' '}
                {formatDuration(durationBetween(run.startedAt, run.finishedAt))}
              </span>
            </span>
            <Cost usd={run.costUsd} authSource={runAuthSource(run)} className="text-xs" plain />
          </button>
        </li>
      ))}
    </ol>
  )
}
