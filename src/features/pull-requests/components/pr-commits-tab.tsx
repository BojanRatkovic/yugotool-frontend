import { PrAvatar } from '@/features/pull-requests/components/pr-avatar'
import type { PrCiState, PullRequestDetail } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const CI_DOT: Record<PrCiState, { className: string; label: string } | null> = {
  success: { className: 'bg-status-passed', label: 'CI passed' },
  failure: { className: 'bg-status-failed', label: 'CI failed' },
  pending: { className: 'bg-status-running', label: 'CI running' },
  none: null,
}

/** The PR's commits, oldest first; each opens on GitHub. */
export function PrCommitsTab({ pr }: { pr: PullRequestDetail }) {
  const repoUrl = pr.url.replace(/\/pull\/\d+$/, '')
  return (
    <div className="h-full overflow-y-auto">
      <ol className="mx-auto flex max-w-3xl flex-col divide-y px-4 py-4">
        {pr.truncated.commits ? (
          <li className="pb-2 text-xs text-muted-foreground">
            Showing the last {pr.commits.length} commits.
          </li>
        ) : null}
        {pr.commits.map((commit) => {
          const ci = CI_DOT[commit.ci]
          return (
            <li key={commit.oid} className="flex items-center gap-3 py-2">
              {commit.author === null ? null : (
                <PrAvatar actor={commit.author} className="size-5" />
              )}
              <a
                href={`${repoUrl}/commit/${commit.oid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-[0.8125rem] hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {commit.messageHeadline}
              </a>
              {ci === null ? null : (
                <span title={ci.label} className="flex items-center">
                  <span
                    aria-hidden="true"
                    className={cn('size-2 rounded-full', ci.className)}
                  />
                  <span className="sr-only">{ci.label}</span>
                </span>
              )}
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {commit.oid.slice(0, 7)}
              </span>
              <time
                dateTime={commit.committedAt}
                title={new Date(commit.committedAt).toLocaleString()}
                className="w-24 shrink-0 text-right text-xs text-muted-foreground"
              >
                {formatRelative(commit.committedAt)}
              </time>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
