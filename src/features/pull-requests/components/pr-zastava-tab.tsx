import { useQuery } from '@tanstack/react-query'

import { prQueries } from '@/features/pull-requests/api/pr-queries'
import type { PullRequestDetail } from '@/lib/contracts'

/** The PR's ZASTAVA review (spec 0009): summary and findings to triage. */
export function PrZastavaTab({
  projectId,
  pr,
}: {
  projectId: string
  pr: PullRequestDetail
  onOpenFile: (file: string) => void
}) {
  const query = useQuery(prQueries.zastavaReview(projectId, pr.number, pr.headOid))
  const review = query.data?.review ?? null
  return (
    <div className="h-full overflow-y-auto p-4 text-[0.8125rem]">
      {review === null ? (
        <p className="text-muted-foreground">No ZASTAVA review yet. Press Z to start one.</p>
      ) : (
        <p>{review.verdict?.summary ?? 'Reviewing…'}</p>
      )}
    </div>
  )
}
