import { useEffect, useMemo, useState } from 'react'

import type { PrPanelState } from '@/features/pull-requests/components/pr-panel'
import { PrThread } from '@/features/pull-requests/components/pr-thread'
import { PrThreadActions } from '@/features/pull-requests/components/pr-thread-actions'
import {
  filterThreads,
  hunkTail,
  waitsOnMe,
  type ThreadFilter,
} from '@/features/pull-requests/utils/threads'
import type { PullRequestDetail } from '@/lib/contracts'
import { isTypingTarget } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: 'waiting', label: 'Waiting on me' },
  { key: 'unresolved', label: 'Unresolved' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
]

const HUNK_LINE: Record<string, string> = {
  '+': 'bg-status-passed-soft/70',
  '-': 'bg-status-failed-soft/70',
}

/**
 * Every review thread in one list, with its code: filtered to the ones
 * waiting on you when there are any. Keys: j/k move, r reply, e resolve.
 */
export function PrThreadsTab({
  projectId,
  pr,
  viewer,
  state,
  onChange,
}: {
  projectId: string
  pr: PullRequestDetail
  viewer: string
  state: PrPanelState
  onChange: (next: Partial<PrPanelState>) => void
}) {
  const waitingCount = pr.reviewThreads.filter((t) => waitsOnMe(t, pr, viewer)).length
  const [filter, setFilter] = useState<ThreadFilter>(
    waitingCount > 0 ? 'waiting' : 'unresolved',
  )
  const threads = useMemo(
    () => filterThreads(pr.reviewThreads, filter, pr, viewer),
    [pr, filter, viewer],
  )
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f.key, filterThreads(pr.reviewThreads, f.key, pr, viewer).length]),
      ),
    [pr, viewer],
  )

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return
      const at = threads.findIndex((t) => t.id === state.thread)
      if (event.key === 'j' || event.key === 'k') {
        const next =
          threads[Math.max(0, Math.min(threads.length - 1, at + (event.key === 'j' ? 1 : -1)))]
        if (next === undefined) return
        event.preventDefault()
        onChange({ thread: next.id })
        document
          .querySelector(`[data-thread-row="${CSS.escape(next.id)}"]`)
          ?.scrollIntoView({ block: 'nearest' })
      } else if ((event.key === 'r' || event.key === 'e') && state.thread !== undefined) {
        const attr = event.key === 'r' ? 'data-reply-for' : 'data-resolve-for'
        const button = document.querySelector<HTMLElement>(
          `[${attr}="${CSS.escape(state.thread)}"]`,
        )
        if (button === null) return
        event.preventDefault()
        button.click()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="radiogroup"
        aria-label="Show threads"
        className="flex flex-wrap gap-2 border-b px-4 py-2"
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              filter === f.key && 'border-foreground/30 bg-accent font-medium',
            )}
          >
            {f.label}
            <span className="font-mono text-muted-foreground tabular-nums">
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {filter === 'waiting' ? 'No threads wait on you.' : 'No threads here.'}
          </p>
        ) : (
          <ul className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4">
            {threads.map((thread) => (
              <li key={thread.id} data-thread-row={thread.id} className="flex flex-col gap-0">
                <div className="flex items-center gap-2 pb-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ tab: 'files', file: thread.path, thread: thread.id })
                    }
                    className="truncate font-mono text-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                    title="Open in Files"
                  >
                    {thread.path}
                    {thread.line === null ? '' : `:${thread.line}`}
                  </button>
                  {thread.isOutdated ? (
                    <span className="rounded-sm bg-muted px-1.5 text-[0.6875rem] text-muted-foreground">
                      Outdated
                    </span>
                  ) : null}
                  {waitsOnMe(thread, pr, viewer) ? (
                    <span className="rounded-sm bg-status-waiting-soft px-1.5 text-[0.6875rem] font-medium text-status-waiting">
                      Waiting on you
                    </span>
                  ) : null}
                </div>
                <pre className="overflow-x-auto rounded-t-md border border-b-0 bg-card font-mono text-[0.75rem] leading-5">
                  {hunkTail(thread.diffHunk).map((line, index) => (
                    <div
                      key={index}
                      className={cn('px-3 whitespace-pre', HUNK_LINE[line.charAt(0)])}
                    >
                      {line === '' ? ' ' : line}
                    </div>
                  ))}
                </pre>
                <PrThread
                  thread={thread}
                  focused={thread.id === state.thread}
                  className="rounded-t-none"
                  actions={
                    <PrThreadActions projectId={projectId} number={pr.number} thread={thread} />
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
