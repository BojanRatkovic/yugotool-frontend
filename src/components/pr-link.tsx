import { ExternalLink, GitPullRequest } from 'lucide-react'

import { parsePullRequest, pullRequestLabel } from '@/lib/links'
import { cn } from '@/lib/utils'

/**
 * A pull request, opened in a new tab. `button` is the prominent header/banner
 * form; `inline` is the compact board-card form. Clicks never reach the card
 * or a drag handle underneath.
 */
export function PrLink({
  url,
  variant = 'inline',
  className,
}: {
  url: string
  variant?: 'button' | 'inline'
  className?: string
}) {
  const pr = parsePullRequest(url)
  const title = pr.repo === null ? url : `${pr.repo} · ${pullRequestLabel(pr, 'Pull request')}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        variant === 'button'
          ? 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-status-passed/40 bg-status-passed-soft px-2.5 text-[0.8125rem] font-medium text-foreground transition-colors hover:border-status-passed/70'
          : 'inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1 font-mono text-[0.6875rem] text-foreground hover:bg-accent',
        className,
      )}
    >
      <GitPullRequest
        aria-hidden="true"
        className={cn(
          'shrink-0 text-status-passed',
          variant === 'button' ? 'size-4' : 'size-3.5',
        )}
      />
      {variant === 'button' ? (
        <>
          {pr.number === null ? 'Pull request' : 'PR'}
          {pr.number === null ? null : (
            <span className="font-mono tabular-nums">#{pr.number}</span>
          )}
          <ExternalLink aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </>
      ) : (
        <span className="tabular-nums">{pr.number === null ? 'PR' : `#${pr.number}`}</span>
      )}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}
