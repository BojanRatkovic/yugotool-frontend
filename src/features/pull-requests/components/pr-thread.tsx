import { ChevronRight, CircleCheck } from 'lucide-react'
import { useState } from 'react'

import { GithubHtml } from '@/features/pull-requests/components/github-html'
import { PrAvatar } from '@/features/pull-requests/components/pr-avatar'
import type { PrThread as Thread } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A review thread: its comments (pending ones marked), collapsed to one line
 * when resolved. `actions` renders the reply box and resolve button.
 */
export function PrThread({
  thread,
  focused = false,
  actions,
  className,
}: {
  thread: Thread
  /** The thread the URL points at: highlighted and scrolled to. */
  focused?: boolean
  actions?: React.ReactNode
  className?: string
}) {
  const [expanded, setExpanded] = useState(!thread.isResolved)
  const first = thread.comments[0]
  return (
    <article
      data-pr-thread={thread.id}
      aria-label={`Thread by ${first?.author.login ?? 'someone'}${thread.isResolved ? ', resolved' : ''}`}
      className={cn(
        'rounded-md border bg-card font-sans text-[0.8125rem] whitespace-normal',
        focused && 'ring-2 ring-ring',
        className,
      )}
    >
      {thread.isResolved || thread.isOutdated ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ChevronRight
            aria-hidden="true"
            className={cn('size-3 shrink-0 transition-transform', expanded && 'rotate-90')}
          />
          {thread.isResolved ? (
            <CircleCheck aria-hidden="true" className="size-3.5 text-status-passed" />
          ) : null}
          <span className="truncate">
            {thread.isResolved ? 'Resolved' : 'Outdated'} · {first?.author.login ?? 'someone'} ·{' '}
            {thread.comments.length} comment{thread.comments.length === 1 ? '' : 's'}
          </span>
        </button>
      ) : null}
      {expanded ? (
        <>
          <ol className="flex flex-col divide-y">
            {thread.comments.map((comment) => (
              <li key={comment.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <PrAvatar actor={comment.author} className="size-5" />
                  <span className="font-medium">{comment.author.login}</span>
                  <time
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                    className="text-muted-foreground"
                  >
                    {formatRelative(comment.createdAt)}
                  </time>
                  {comment.isPending ? (
                    <span className="rounded-sm bg-status-waiting-soft px-1.5 text-[0.6875rem] font-medium text-status-waiting">
                      Pending
                    </span>
                  ) : null}
                </div>
                <GithubHtml html={comment.bodyHtml} />
              </li>
            ))}
          </ol>
          {actions === undefined ? null : <div className="border-t px-3 py-2">{actions}</div>}
        </>
      ) : null}
    </article>
  )
}
