import {
  ExternalLink,
  LoaderCircle,
  ScanSearch,
  GitBranch,
  Link2,
  MessageSquare,
  SquareArrowOutUpRight,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PrAvatar } from '@/features/pull-requests/components/pr-avatar'
import { shortAge, type PrPlacement } from '@/features/pull-requests/utils/columns'
import { prSize, sizeLabel } from '@/features/pull-requests/utils/size'
import { findingsLabel, type ZastavaState } from '@/features/pull-requests/utils/zastava'
import type { PrCiState, PrReviewer, PullRequestSummary } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const REASON_TONE: Record<PrPlacement['tone'], string> = {
  failed: 'text-status-failed',
  waiting: 'text-status-waiting',
  muted: 'text-muted-foreground',
}

const CI_DOT: Record<PrCiState, { className: string; label: string } | null> = {
  success: { className: 'bg-status-passed', label: 'CI passed' },
  failure: { className: 'bg-status-failed', label: 'CI failed' },
  pending: { className: 'bg-status-running animate-pulse-soft', label: 'CI running' },
  none: null,
}

const REVIEW_BADGE: Partial<
  Record<PrReviewer['state'], { mark: string; className: string; label: string }>
> = {
  APPROVED: { mark: '✓', className: 'bg-status-passed', label: 'approved' },
  CHANGES_REQUESTED: { mark: '±', className: 'bg-status-failed', label: 'requested changes' },
  REQUESTED: { mark: '●', className: 'bg-status-queued', label: 'review requested' },
  COMMENTED: { mark: '•', className: 'bg-muted-foreground', label: 'commented' },
}

function copy(text: string, what: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied.`),
    () => toast.error("Couldn't copy to the clipboard."),
  )
}

/** Avatars of the reviewers, each with a small state mark; teams by initial. */
function ReviewerStack({ reviewers }: { reviewers: PrReviewer[] }) {
  if (reviewers.length === 0) return null
  const shown = reviewers.slice(0, 4)
  const summary = reviewers
    .map(
      (r) =>
        `${'team' in r ? r.team : r.actor.login}: ${REVIEW_BADGE[r.state]?.label ?? r.state.toLowerCase()}`,
    )
    .join(', ')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="relative z-10 flex items-center -space-x-1"
          aria-label={`Reviewers: ${summary}`}
        >
          {shown.map((r) => {
            const login = 'team' in r ? r.team : r.actor.login
            const badge = REVIEW_BADGE[r.state]
            return (
              <span key={login} className="relative">
                <PrAvatar
                  actor={'team' in r ? { login: r.team, avatarUrl: '' } : r.actor}
                  className="ring-2 ring-card"
                />
                {badge === undefined ? null : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute -right-0.5 -bottom-0.5 flex size-2 items-center justify-center rounded-full text-[0.4rem] leading-none text-background ring-1 ring-card',
                      badge.className,
                    )}
                  />
                )}
              </span>
            )
          })}
          {reviewers.length > shown.length ? (
            <span className="pl-1.5 text-[0.625rem]">+{reviewers.length - shown.length}</span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{summary}</TooltipContent>
    </Tooltip>
  )
}

/** The PR's ZASTAVA review on its card: running, findings to triage, or stale. */
function ZastavaChip({ state }: { state: ZastavaState }) {
  if (state.kind === 'none') return null
  if (state.kind === 'running') {
    return (
      <span
        className="flex items-center gap-0.5 text-status-running"
        title="ZASTAVA is reviewing"
      >
        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
        <span className="sr-only">ZASTAVA is reviewing</span>
      </span>
    )
  }
  if (state.kind === 'failed') {
    return (
      <span
        className="flex items-center gap-0.5 text-status-failed"
        title="ZASTAVA review failed"
      >
        <ScanSearch aria-hidden="true" className="size-3" />
        <span className="sr-only">ZASTAVA review failed</span>
      </span>
    )
  }
  if (state.reReview) {
    return (
      <span
        className="flex items-center gap-0.5 text-foreground"
        title={`ZASTAVA: re-review (${state.findings} finding${state.findings === 1 ? '' : 's'} on an older commit)`}
      >
        <ScanSearch aria-hidden="true" className="size-3" />
        <span>Re-review</span>
      </span>
    )
  }
  const label = `ZASTAVA: ${findingsLabel(state)}${state.stale ? ' (older commit)' : ''}`
  return (
    <span
      className={cn(
        'flex items-center gap-0.5',
        state.open > 0 && 'text-foreground',
        state.stale && 'opacity-60',
      )}
      title={label}
    >
      <ScanSearch aria-hidden="true" className="size-3" />
      <span className="sr-only">{label}</span>
      {state.open > 0 ? <span aria-hidden="true">{state.open}</span> : null}
    </span>
  )
}

/** A PR on the board: number, title, why it's in this column, and the vitals. */
export function PrCard({
  pr,
  placement,
  needsYou,
  showAuthor,
  onOpen,
  now,
  zastava = { kind: 'none' },
}: {
  pr: PullRequestSummary
  placement: PrPlacement
  needsYou: boolean
  showAuthor: boolean
  onOpen: (number: number) => void
  now: number
  /** Its latest ZASTAVA review (spec 0009). */
  zastava?: ZastavaState
}) {
  const size = prSize(pr.additions, pr.deletions)
  const ci = CI_DOT[pr.ci]
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article className="group relative flex min-h-18 w-full shrink-0 flex-col items-start gap-1.5 rounded-md border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:border-foreground/15 hover:bg-accent/60">
          {needsYou ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-status-waiting"
            />
          ) : null}
          <button
            type="button"
            data-pr-card={pr.number}
            onClick={() => onOpen(pr.number)}
            className="w-full text-left text-[0.8125rem] leading-5 font-medium outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            <span className="line-clamp-2 break-words">
              <span className="mr-1.5 font-mono text-[0.6875rem] font-normal text-muted-foreground">
                #{pr.number}
              </span>
              {pr.title}
            </span>
          </button>
          <p className={cn('w-full truncate text-xs', REASON_TONE[placement.tone])}>
            {placement.reason}
          </p>
          <div className="flex w-full min-w-0 items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
            {showAuthor ? (
              <span className="flex min-w-0 items-center gap-1" title={pr.author.login}>
                <PrAvatar actor={pr.author} />
                <span className="truncate">{pr.author.login}</span>
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals +additions −deletions
                  tabIndex={0}
                  className="relative z-10 rounded-sm bg-muted px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Size ${size}: ${sizeLabel(pr.additions, pr.deletions)} in ${pr.changedFiles} files`}
                >
                  {size}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {sizeLabel(pr.additions, pr.deletions)} · {pr.changedFiles} file
                {pr.changedFiles === 1 ? '' : 's'}
              </TooltipContent>
            </Tooltip>
            {ci === null ? null : (
              <span title={ci.label} className="flex items-center">
                <span
                  aria-hidden="true"
                  className={cn('size-2 shrink-0 rounded-full', ci.className)}
                />
                <span className="sr-only">{ci.label}</span>
              </span>
            )}
            <span className="ml-auto flex items-center gap-2">
              <ZastavaChip state={zastava} />
              <ReviewerStack reviewers={pr.reviewers} />
              {pr.threads.unresolved === 0 ? null : (
                <span
                  className={cn(
                    'flex items-center gap-0.5',
                    pr.threads.waitingOnMe > 0 && 'text-status-waiting',
                  )}
                  title={`${pr.threads.waitingOnMe} of ${pr.threads.unresolved} open threads wait on you`}
                >
                  <MessageSquare aria-hidden="true" className="size-3" />
                  <span className="sr-only">Threads waiting on you / open: </span>
                  {pr.threads.waitingOnMe}/{pr.threads.unresolved}
                </span>
              )}
              <time
                dateTime={pr.updatedAt}
                title={`Updated ${new Date(pr.updatedAt).toLocaleString()}`}
              >
                {shortAge(pr.updatedAt, now)}
              </time>
            </span>
          </div>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => onOpen(pr.number)}>
          <SquareArrowOutUpRight aria-hidden="true" />
          Open
        </ContextMenuItem>
        <ContextMenuItem asChild>
          <a href={pr.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Open on GitHub
          </a>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copy(pr.headRefName, 'Branch name')}>
          <GitBranch aria-hidden="true" />
          Copy branch name
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copy(pr.url, 'Link')}>
          <Link2 aria-hidden="true" />
          Copy link
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
