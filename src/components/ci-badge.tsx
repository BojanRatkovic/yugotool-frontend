import type { AnyStatus } from '@/components/status/status'
import { StatusIcon } from '@/components/status/status-chip'
import type { CiState, CiStatus } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS: Record<CiState, AnyStatus> = {
  pending: 'running',
  passed: 'succeeded',
  failed: 'failed',
  no_ci: 'skipped',
  timed_out: 'skipped',
}

const LABEL: Record<CiState, string> = {
  pending: 'CI running',
  passed: 'CI passed',
  failed: 'CI failed',
  no_ci: 'No CI',
  timed_out: 'CI timed out',
}

/** Where a click goes: the first failing check, else the PR's checks tab. */
export function ciLink(ci: CiStatus, prUrl: string): string {
  const failing = ci.checks.find((c) => c.bucket === 'fail' || c.bucket === 'cancel')
  return failing?.link ?? `${prUrl}/checks`
}

/** "CI failed · 1 failed · 3 passed · checked 4 min ago · newer commit on the PR". */
export function ciTitle(ci: CiStatus, now = Date.now()): string {
  const newer =
    ci.deliveredSha !== null && ci.headSha !== null && ci.headSha !== ci.deliveredSha
      ? ` · on ${ci.headSha.slice(0, 7)}, newer than YugoTool's push`
      : ''
  return `${LABEL[ci.state]} · ${ci.summary} · checked ${formatRelative(ci.checkedAt, now)}${newer}`
}

/**
 * The PR's CI as a link: `full` in the Delivered banner (label and summary),
 * `inline` on board cards (icon and label). Clicks never reach the card.
 */
export function CiBadge({
  ci,
  prUrl,
  variant = 'inline',
  className,
}: {
  ci: CiStatus
  prUrl: string
  variant?: 'full' | 'inline'
  className?: string
}) {
  const status = STATUS[ci.state]
  return (
    <a
      href={ciLink(ci, prUrl)}
      target="_blank"
      rel="noopener noreferrer"
      title={ciTitle(ci)}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-sm hover:bg-accent',
        variant === 'full' ? 'h-7 px-1.5 text-[0.8125rem]' : 'h-6 px-1 text-[0.6875rem]',
        className,
      )}
    >
      <StatusIcon status={status} />
      <span className={cn('shrink-0', ci.state === 'failed' && 'text-status-failed')}>
        {LABEL[ci.state]}
      </span>
      {variant === 'full' ? (
        <span className="truncate font-mono text-xs text-muted-foreground">{ci.summary}</span>
      ) : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
