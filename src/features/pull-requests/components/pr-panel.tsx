import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { LoadError } from '@/components/data-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { PrHeader } from '@/features/pull-requests/components/pr-header'
import { PrReadiness } from '@/features/pull-requests/components/pr-readiness'
import { PrTabBody } from '@/features/pull-requests/components/pr-tab-body'
import { ApiError } from '@/lib/api-client'
import type { PullRequestDetail } from '@/lib/contracts'
import { isTypingTarget } from '@/lib/shortcuts'

export const PR_TABS = ['overview', 'files', 'threads', 'checks', 'commits'] as const
export type PrTab = (typeof PR_TABS)[number]

/** The panel's URL state (the route owns it). */
export interface PrPanelState {
  tab: PrTab
  /** Files tab: the file shown. */
  file: string | undefined
  /** A focused thread (Threads tab, or inline in Files). */
  thread: string | undefined
  /** Files tab: "review" = only the changes since my last review, "all" = the whole PR; unset = the default (on in Re-review). */
  since: 'review' | 'all' | undefined
  full: boolean
}

const TAB_LABEL: Record<PrTab, string> = {
  overview: 'Overview',
  files: 'Files',
  threads: 'Threads',
  checks: 'Checks',
  commits: 'Commits',
}

function tabCount(pr: PullRequestDetail, tab: PrTab): number | null {
  switch (tab) {
    case 'files':
      return pr.changedFiles
    case 'threads':
      return pr.threads.unresolved
    case 'commits':
      return pr.commits.length
    default:
      return null
  }
}

function PanelSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="border-b px-4 py-2.5">
        <Skeleton className="h-6 w-full" />
      </div>
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * A pull request, with everything needed to act on it without GitHub:
 * whose move it is, the conversation, files, threads, checks and commits.
 */
export function PrPanel({
  projectId,
  number,
  viewer,
  state,
  onChange,
  onClose,
}: {
  projectId: string
  number: number
  /** The gh user's login ("me" in the board rules). */
  viewer: string
  state: PrPanelState
  onChange: (next: Partial<PrPanelState>) => void
  onClose: () => void
}) {
  const detail = useQuery(prQueries.detail(projectId, number))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      const tab = PR_TABS[Number(event.key) - 1]
      if (tab !== undefined) {
        event.preventDefault()
        onChange({ tab })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const pr = detail.data
  if (pr === undefined) {
    if (detail.error instanceof ApiError && detail.error.status === 404) {
      return (
        <div className="flex h-full flex-col items-start gap-2 p-6">
          <p className="text-sm font-medium">Pull request #{number} not found</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            It may be in another repository, or GitHub no longer has it.
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Back to the board
          </Button>
        </div>
      )
    }
    if (detail.error !== null) {
      return (
        <div className="p-4">
          <LoadError what={`pull request #${number}`} message={detail.error.message} />
        </div>
      )
    }
    return <PanelSkeleton />
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PrHeader
        pr={pr}
        full={state.full}
        onToggleFull={() => onChange({ full: !state.full })}
        onClose={onClose}
      />
      <PrReadiness pr={pr} viewer={viewer} onOpen={(tab) => onChange({ tab })} />
      <Tabs
        value={state.tab}
        onValueChange={(value) =>
          onChange({ tab: PR_TABS.find((t) => t === value) ?? 'overview' })
        }
        className="gap-0"
      >
        <div className="flex h-10 items-center gap-3 border-b px-4">
          <TabsList variant="line" className="h-10 gap-4 p-0">
            {PR_TABS.map((tab, index) => {
              const count = tabCount(pr, tab)
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="px-0 text-[0.8125rem]"
                  title={`${TAB_LABEL[tab]} (${index + 1})`}
                >
                  {TAB_LABEL[tab]}
                  {count === null || count === 0 ? null : (
                    <span className="rounded-sm bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>
      </Tabs>
      <div className="relative min-h-0 flex-1">
        <PrTabBody
          tab={state.tab}
          projectId={projectId}
          pr={pr}
          viewer={viewer}
          state={state}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
