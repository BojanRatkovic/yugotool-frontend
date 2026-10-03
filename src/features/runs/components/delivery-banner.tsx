import { useQuery } from '@tanstack/react-query'
import { CircleCheck, ExternalLink, GitPullRequest } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runQueries } from '@/features/runs/api/run-queries'
import type { Run } from '@/lib/contracts'
import { parseDelivery, parsePullRequest, pullRequestLabel, type Delivery } from '@/lib/links'

/** The run's delivery: the PR from the work order, else the worker's summary event. */
function useDelivery(run: Run, prUrl: string | null): Delivery | null {
  const events = useQuery({ ...runQueries.events(run.id), enabled: prUrl === null })
  if (prUrl !== null) return { kind: 'pull_request', pr: parsePullRequest(prUrl) }
  for (const event of (events.data ?? []).toReversed()) {
    if (event.type !== 'system' || event.stationRunId !== null) continue
    const delivery = parseDelivery(event.message)
    if (delivery !== null) return delivery
  }
  return null
}

/**
 * Top-of-panel success state for a delivered run: the PR to open, or where the
 * branch went. Rendered by the panel only for the latest run once it succeeded.
 */
export function DeliveryBanner({
  run,
  prUrl,
  branch,
}: {
  run: Run
  prUrl: string | null
  branch: string | null
}) {
  const delivery = useDelivery(run, prUrl)
  const pr = delivery?.kind === 'pull_request' ? delivery.pr : null
  const detail =
    delivery === null
      ? branch === null
        ? 'The line finished.'
        : `Committed on ${branch}`
      : delivery.kind === 'pull_request'
        ? `${pullRequestLabel(delivery.pr, 'Pull request')} opened`
        : delivery.kind === 'pushed'
          ? `Pushed ${delivery.branch}`
          : `Committed on ${delivery.branch}`

  return (
    <section
      aria-label="Delivered"
      className="flex items-center gap-3 bg-status-passed-soft px-4 py-2.5"
    >
      {pr === null ? (
        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-status-passed" />
      ) : (
        <GitPullRequest aria-hidden="true" className="size-4 shrink-0 text-status-passed" />
      )}
      <p className="flex min-w-0 flex-1 items-baseline gap-2 text-sm">
        <span className="shrink-0 font-semibold text-status-passed">Delivered</span>
        <span className="text-muted-foreground">·</span>
        <span className="truncate">{detail}</span>
        {pr?.repo == null ? null : (
          <span className="truncate font-mono text-xs text-muted-foreground">{pr.repo}</span>
        )}
      </p>
      {pr === null ? null : (
        <Button asChild size="sm">
          <a href={pr.url} target="_blank" rel="noopener noreferrer">
            Open PR
            <ExternalLink aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      )}
    </section>
  )
}

/**
 * Toasts once when the open work order gets its PR (the run delivered while
 * you watched). Not on mount: an order that already had a PR stays quiet.
 */
export function useDeliveredToast(prUrl: string | null) {
  const previous = useRef(prUrl)
  useEffect(() => {
    if (previous.current === null && prUrl !== null) {
      const pr = parsePullRequest(prUrl)
      toast.success(`Delivered · ${pullRequestLabel(pr, 'Pull request')} opened`, {
        action: { label: 'Open PR', onClick: () => window.open(prUrl, '_blank', 'noopener') },
        duration: 10_000,
      })
    }
    previous.current = prUrl
  }, [prUrl])
}
