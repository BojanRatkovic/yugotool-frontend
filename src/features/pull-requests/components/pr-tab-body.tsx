import type { PrPanelState, PrTab } from '@/features/pull-requests/components/pr-panel'
import { PrFilesTab } from '@/features/pull-requests/components/pr-files-tab'
import { PrOverviewTab } from '@/features/pull-requests/components/pr-overview-tab'
import type { PullRequestDetail } from '@/lib/contracts'

/** The selected tab's content. */
export function PrTabBody({
  tab,
  projectId,
  pr,
  viewer,
  state,
  onChange,
}: {
  tab: PrTab
  projectId: string
  pr: PullRequestDetail
  viewer: string
  state: PrPanelState
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
    case 'files':
      return (
        <PrFilesTab
          projectId={projectId}
          pr={pr}
          viewer={viewer}
          state={state}
          onChange={onChange}
        />
      )
    default:
      // Threads, Checks, Commits: spec 0008 T14–T15.
      return (
        <p className="p-4 text-sm text-muted-foreground">
          {tab} · #{pr.number}
        </p>
      )
  }
}
