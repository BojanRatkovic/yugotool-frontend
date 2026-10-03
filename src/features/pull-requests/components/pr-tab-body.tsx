import type { PrPanelState, PrTab } from '@/features/pull-requests/components/pr-panel'
import { PrOverviewTab } from '@/features/pull-requests/components/pr-overview-tab'
import type { PullRequestDetail } from '@/lib/contracts'

/** The selected tab's content. */
export function PrTabBody({
  tab,
  projectId,
  pr,
  onChange,
}: {
  tab: PrTab
  projectId: string
  pr: PullRequestDetail
  onChange: (next: Partial<PrPanelState>) => void
}) {
  switch (tab) {
    case 'overview':
      return (
        <PrOverviewTab
          projectId={projectId}
          pr={pr}
          onOpenThreads={(thread) => onChange({ tab: 'threads', thread })}
        />
      )
    default:
      // Files, Threads, Checks, Commits: spec 0008 T13–T15.
      return (
        <p className="p-4 text-sm text-muted-foreground">
          {tab} · #{pr.number}
        </p>
      )
  }
}
