import type { PrTab } from '@/features/pull-requests/components/pr-panel'
import type { PullRequestDetail } from '@/lib/contracts'

/** The selected tab's content. */
export function PrTabBody({ tab, pr }: { tab: PrTab; pr: PullRequestDetail }) {
  // Filled in tab by tab (spec 0008 T12–T15).
  return (
    <p className="p-4 text-sm text-muted-foreground">
      {tab} · #{pr.number}
    </p>
  )
}
