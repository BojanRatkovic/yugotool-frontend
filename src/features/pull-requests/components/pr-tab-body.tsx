import type { PrPanelState, PrTab } from '@/features/pull-requests/components/pr-panel'
import { PrChecksTab } from '@/features/pull-requests/components/pr-checks-tab'
import { PrCommitsTab } from '@/features/pull-requests/components/pr-commits-tab'
import { PrFilesTab } from '@/features/pull-requests/components/pr-files-tab'
import { PrThreadsTab } from '@/features/pull-requests/components/pr-threads-tab'
import { PrOverviewTab } from '@/features/pull-requests/components/pr-overview-tab'
import { PrZastavaTab } from '@/features/pull-requests/components/pr-zastava-tab'
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
    case 'threads':
      return (
        <PrThreadsTab
          projectId={projectId}
          pr={pr}
          viewer={viewer}
          state={state}
          onChange={onChange}
        />
      )
    case 'checks':
      return <PrChecksTab pr={pr} />
    case 'commits':
      return <PrCommitsTab pr={pr} />
    case 'zastava':
      return (
        <PrZastavaTab
          projectId={projectId}
          pr={pr}
          onOpenFile={(file) => onChange({ tab: 'files', file })}
        />
      )
    default:
      return null
  }
}
