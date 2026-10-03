import { useQuery } from '@tanstack/react-query'
import { LoaderCircle, ScanSearch } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useStartZastavaReview } from '@/features/pull-requests/api/pr-mutations'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { findingsLabel, fromReview } from '@/features/pull-requests/utils/zastava'
import type { PullRequestDetail } from '@/lib/contracts'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * "Review with ZASTAVA" in the PR header (spec 0009). While a review runs it
 * is a progress pill; when it is done, the count of findings left to triage.
 * Either opens the ZASTAVA tab.
 */
export function ZastavaReviewButton({
  projectId,
  pr,
  onOpen,
}: {
  projectId: string
  pr: PullRequestDetail
  onOpen: () => void
}) {
  const query = useQuery(prQueries.zastavaReview(projectId, pr.number, pr.headOid))
  const start = useStartZastavaReview(projectId, pr.number)
  if (pr.state !== 'open' || query.data === undefined) return null
  const review = query.data.review
  const state = fromReview(review)

  if (state.kind === 'running' || start.isPending) {
    return (
      <Button variant="outline" size="sm" className="mr-1" onClick={onOpen}>
        <LoaderCircle aria-hidden="true" className="animate-spin" />
        Reviewing…
        {review === null ? null : (
          <span className="font-mono text-muted-foreground tabular-nums">
            {formatUsd(review.costUsd)}
          </span>
        )}
      </Button>
    )
  }

  if (state.kind === 'done') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="mr-1" onClick={onOpen}>
            <ScanSearch aria-hidden="true" />
            <span className={cn(state.open > 0 && 'font-semibold')}>
              {findingsLabel(state)}
            </span>
            {state.stale ? (
              <span className="rounded-sm bg-status-waiting/15 px-1 text-[0.6875rem] text-status-waiting">
                stale
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          ZASTAVA review{state.stale ? ' of an older commit' : ''}{' '}
          <span className="font-mono">Z</span>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="mr-1"
          onClick={() =>
            start.mutate(undefined, {
              onSuccess: onOpen,
              onError: (error) => toast.error(error.message),
            })
          }
        >
          <ScanSearch aria-hidden="true" />
          {state.kind === 'failed' ? 'Review again' : 'Review with ZASTAVA'}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {state.kind === 'failed' && review?.error
          ? `Last review failed: ${review.error}`
          : 'Findings land here first; you pick what goes to GitHub.'}{' '}
        <span className="font-mono">Z</span>
      </TooltipContent>
    </Tooltip>
  )
}
