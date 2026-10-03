import { CircleAlert, CircleCheck, CircleDashed, CircleX, type LucideIcon } from 'lucide-react'

import {
  readiness,
  type ChipState,
  type Readiness,
} from '@/features/pull-requests/utils/readiness'
import type { PullRequestDetail } from '@/lib/contracts'
import { cn } from '@/lib/utils'

export type ReadinessTarget = 'overview' | 'threads' | 'checks'

const CHIP: Record<ChipState, { Icon: LucideIcon; className: string; label: string }> = {
  ok: { Icon: CircleCheck, className: 'text-status-passed', label: 'ok' },
  fail: { Icon: CircleX, className: 'text-status-failed', label: 'blocking' },
  wait: { Icon: CircleAlert, className: 'text-status-waiting', label: 'waiting' },
  none: { Icon: CircleDashed, className: 'text-muted-foreground', label: 'n/a' },
}

const VERDICT_TONE: Record<Readiness['tone'], string> = {
  ok: 'text-status-passed',
  failed: 'text-status-failed',
  waiting: 'text-status-waiting',
  muted: 'text-foreground',
}

function Chip({
  label,
  value,
  state,
  onClick,
}: {
  label: string
  value: string
  state: ChipState
  onClick: () => void
}) {
  const chip = CHIP[state]
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-card px-2 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
      <chip.Icon aria-hidden="true" className={cn('size-3.5', chip.className)} />
      <span className="sr-only">({chip.label})</span>
    </button>
  )
}

/**
 * Whose move it is: one sentence, plus reviews / checks / threads /
 * mergeability chips that open the matching tab. The verdict is announced
 * when a refetch changes it.
 */
export function PrReadiness({
  pr,
  viewer,
  onOpen,
}: {
  pr: PullRequestDetail
  viewer: string
  onOpen: (target: ReadinessTarget) => void
}) {
  const r = readiness(pr, viewer)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card/40 px-4 py-2.5">
      <p
        aria-live="polite"
        className={cn('mr-auto text-[0.8125rem] font-medium', VERDICT_TONE[r.tone])}
      >
        {r.verdict}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label="Reviews"
          value={`${r.reviews.approved}/${r.reviews.total}`}
          state={r.reviews.state}
          onClick={() => onOpen('overview')}
        />
        <Chip
          label="Checks"
          value={r.checks.total === 0 ? '–' : `${r.checks.passed}/${r.checks.total}`}
          state={r.checks.state}
          onClick={() => onOpen('checks')}
        />
        <Chip
          label="Threads"
          value={
            r.threads.waitingOnMe > 0
              ? `${r.threads.waitingOnMe}/${r.threads.open} on you`
              : `${r.threads.open} open`
          }
          state={r.threads.state}
          onClick={() => onOpen('threads')}
        />
        <Chip
          label="Mergeable"
          value={r.mergeable === 'fail' ? 'conflict' : r.mergeable === 'ok' ? 'yes' : '…'}
          state={r.mergeable}
          onClick={() => onOpen('overview')}
        />
      </div>
    </div>
  )
}
