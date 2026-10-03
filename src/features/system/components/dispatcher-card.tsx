import { useQuery } from '@tanstack/react-query'

import { TONE_BG, type Tone } from '@/components/status/status'
import { Skeleton } from '@/components/ui/skeleton'
import { systemQueries } from '@/features/system/api/system-queries'
import type { DispatcherState } from '@/lib/contracts'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<DispatcherState['status'], Tone> = {
  active: 'running',
  paused_usage: 'waiting',
  waiting_night_shift: 'queued',
  idle: 'skipped',
}

const STATUS_WORD: Record<DispatcherState['status'], string> = {
  active: 'Active',
  paused_usage: 'Paused',
  waiting_night_shift: 'Waiting for the night shift',
  idle: 'Idle',
}

/** The server's reason, plus "resumes 01:00" when it didn't say so itself. */
export function dispatcherReason(state: DispatcherState): string {
  const reason = state.reason.trim() === '' ? STATUS_WORD[state.status] : state.reason
  if (state.resumesAt === null || /resumes/i.test(reason)) return reason
  const at = new Date(state.resumesAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${reason} · resumes ${at}`
}

/** Sidebar footer: what the dispatcher is doing and how many slots are busy. */
export function DispatcherCard() {
  const { data, isPending } = useQuery(systemQueries.dispatcher())

  return (
    <section
      aria-label="Dispatcher"
      className="flex flex-col gap-1.5 rounded-lg border border-sidebar-border bg-background/60 px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="label-caps">Dispatcher</h2>
        {data === undefined ? null : (
          <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
            {/* slots are the free ones; running + free = configured capacity */}
            {data.running}/{data.running + data.slots} running
          </span>
        )}
      </div>
      {isPending ? (
        <Skeleton className="h-4 w-full" aria-busy="true" />
      ) : data === undefined ? (
        <p className="text-xs text-muted-foreground">
          Unavailable — the queue can&rsquo;t be read.
        </p>
      ) : (
        <p
          className="flex items-start gap-2 text-xs text-sidebar-foreground"
          title={`Checked ${formatDateTime(data.checkedAt)}`}
        >
          <span
            aria-hidden="true"
            className={cn(
              'mt-[0.3125rem] size-1.5 shrink-0 rounded-full',
              TONE_BG[STATUS_TONE[data.status]],
              data.status === 'active' && 'animate-pulse-soft',
            )}
          />
          <span className="min-w-0">
            <span className="sr-only">{STATUS_WORD[data.status]}: </span>
            {dispatcherReason(data)}
          </span>
        </p>
      )}
    </section>
  )
}
