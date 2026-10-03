import { useQuery } from '@tanstack/react-query'
import { Ban, ChevronDown, CircleSlash, CircleX, GitBranch } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CodeBlock } from '@/components/code-block'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { runQueries } from '@/features/runs/api/run-queries'
import { DeliveryBanner } from '@/features/runs/components/delivery-banner'
import { runFailure, type RunFailure } from '@/features/runs/utils/failure'
import type { Run } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** DOM id of an Activity row, so a banner can point at it. */
export function activityEventId(eventId: string): string {
  return `activity-event-${eventId}`
}

/** Waits for the row to render (the tab may have just switched), then scrolls to it and flashes it. */
function revealEvent(eventId: string) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let tries = 0
  const attempt = () => {
    const row = document.getElementById(activityEventId(eventId))
    if (row === null) {
      tries += 1
      if (tries < 30) requestAnimationFrame(attempt)
      return
    }
    row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    if (!reduced) {
      row.animate(
        [
          { backgroundColor: 'color-mix(in oklch, var(--status-failed) 18%, transparent)' },
          { backgroundColor: 'transparent' },
        ],
        { duration: 1800, easing: 'ease-out' },
      )
    }
  }
  requestAnimationFrame(attempt)
}

const ICON = { failed: CircleX, rejected: Ban, cancelled: CircleSlash } as const

/**
 * Top-of-panel state for a run that didn't deliver: what failed, the one line
 * that says why (full log on expand), where the work is safe, and a jump to
 * the event in Activity. Same slot and height as the Delivered banner.
 */
function FailureBanner({
  failure,
  onShowActivity,
  action,
}: {
  failure: RunFailure
  onShowActivity: () => void
  action?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const Icon = ICON[failure.kind]
  const failed = failure.kind === 'failed'
  const expandable = failure.detail !== null && failure.detail !== failure.reason
  const { eventId } = failure
  return (
    <section
      aria-label={failure.title}
      className={cn('flex flex-col', failed ? 'bg-status-failed-soft' : 'bg-muted/60')}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <Icon
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0',
            failed ? 'text-status-failed' : 'text-muted-foreground',
          )}
        />
        <p className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
          <span
            className={cn(
              'shrink-0 font-semibold',
              failed ? 'text-status-failed' : 'text-foreground',
            )}
          >
            {failure.title}
          </span>
          {failure.reason === null ? null : (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="truncate" title={failure.reason}>
                {failure.reason}
              </span>
            </>
          )}
        </p>
        {failure.safeBranch === null ? null : (
          <span
            className="flex h-6 max-w-56 shrink-0 items-center gap-1 rounded-md border bg-background/60 pr-0.5 pl-2 font-mono text-xs"
            title={`The work is safe on ${failure.safeBranch}`}
          >
            <GitBranch aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{failure.safeBranch}</span>
            <CopyButton value={failure.safeBranch} label="Copy branch name" />
          </span>
        )}
        {expandable ? (
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 text-muted-foreground"
          >
            Details
            <ChevronDown
              aria-hidden="true"
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </Button>
        ) : null}
        {eventId === null ? null : (
          <Button
            variant="outline"
            size="xs"
            className="shrink-0"
            onClick={() => {
              onShowActivity()
              revealEvent(eventId)
            }}
          >
            Show in Activity
          </Button>
        )}
        {action}
      </div>
      {open && failure.detail !== null ? (
        <div className="px-4 pb-3">
          <CodeBlock code={failure.detail} lang={null} className="bg-background/60" />
        </div>
      ) : null}
    </section>
  )
}

/**
 * The latest run's outcome at the top of the panel: Delivered, or why not.
 * A legacy "succeeded" run whose delivery actually failed shows the failure.
 */
export function RunOutcomeBanner({
  run,
  prUrl,
  branch,
  onShowActivity,
  failureAction,
}: {
  run: Run
  prUrl: string | null
  branch: string | null
  /** Switch to the Activity tab with no station filter. */
  onShowActivity: () => void
  /** Trailing action on a failed, rejected or cancelled run (e.g. Run again). */
  failureAction?: ReactNode
}) {
  const events = useQuery(runQueries.events(run.id))
  const failure = runFailure(run, events.data ?? [])
  if (failure !== null)
    return (
      <FailureBanner failure={failure} onShowActivity={onShowActivity} action={failureAction} />
    )
  if (run.status === 'succeeded')
    return <DeliveryBanner run={run} prUrl={prUrl} branch={branch} />
  return null
}
