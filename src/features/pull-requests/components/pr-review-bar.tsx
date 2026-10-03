import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useDiscardReview } from '@/features/pull-requests/api/pr-mutations'
import { errorMessage } from '@/lib/api-client'
import type { PullRequestDetail } from '@/lib/contracts'

/** My pending review, under Files and Threads: how many comments wait, discard, submit. */
export function PrReviewBar({
  projectId,
  pr,
  onSubmit,
}: {
  projectId: string
  pr: PullRequestDetail
  onSubmit: () => void
}) {
  const discard = useDiscardReview(projectId, pr.number)
  if (pr.pendingReview === null) return null
  const n = pr.pendingReview.comments
  return (
    <div className="flex items-center gap-3 border-t bg-status-waiting-soft px-4 py-2 text-[0.8125rem]">
      <span className="font-medium">Review</span>
      <span className="text-muted-foreground">
        {n} pending comment{n === 1 ? '' : 's'}, visible only to you until you submit
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto"
        disabled={discard.isPending}
        onClick={() =>
          discard.mutate(undefined, {
            onSuccess: () => toast.success('Pending review discarded.'),
            onError: (error) => toast.error(`Couldn't discard: ${errorMessage(error)}`),
          })
        }
      >
        Discard
      </Button>
      <Button size="sm" onClick={onSubmit}>
        Submit review
      </Button>
    </div>
  )
}
