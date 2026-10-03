import { ChevronRight, GitCommitHorizontal, MessageSquare } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { useAddPrComment } from '@/features/pull-requests/api/pr-mutations'
import { GithubHtml } from '@/features/pull-requests/components/github-html'
import { PrAvatar } from '@/features/pull-requests/components/pr-avatar'
import { errorMessage } from '@/lib/api-client'
import type { PrActor, PrTimelineItem, PullRequestDetail } from '@/lib/contracts'
import { formatRelative } from '@/lib/format'
import { IS_MAC } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

const REVIEW_VERB: Record<string, string> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'requested changes',
  COMMENTED: 'reviewed',
  DISMISSED: 'reviewed (dismissed)',
}

const REVIEW_TONE: Record<string, string> = {
  APPROVED: 'text-status-passed',
  CHANGES_REQUESTED: 'text-status-failed',
}

function Time({ iso }: { iso: string }) {
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString()}
      className="text-muted-foreground"
    >
      {formatRelative(iso)}
    </time>
  )
}

/** A comment-like card: who, what, when, and the body. */
function Card({
  author,
  action,
  createdAt,
  bodyHtml,
  empty,
  footer,
}: {
  author: PrActor
  action?: React.ReactNode
  createdAt: string
  bodyHtml: string
  empty?: string
  footer?: React.ReactNode
}) {
  return (
    <article className="rounded-lg border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2 text-xs">
        <PrAvatar actor={author} className="size-5" />
        <span className="font-medium">{author.login}</span>
        {action}
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <Time iso={createdAt} />
      </header>
      <div className="px-3 py-2.5">
        {bodyHtml.trim() === '' ? (
          <p className="text-[0.8125rem] text-muted-foreground italic">
            {empty ?? 'No comment.'}
          </p>
        ) : (
          <GithubHtml html={bodyHtml} />
        )}
      </div>
      {footer === undefined ? null : <footer className="border-t px-3 py-2">{footer}</footer>}
    </article>
  )
}

/** Small events as one muted line. */
function EventLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">{children}</p>
  )
}

const who = (actor: PrActor | null) => actor?.login ?? 'Someone'

function CommitsItem({
  item,
  pr,
}: {
  item: Extract<PrTimelineItem, { kind: 'commits' }>
  pr: PullRequestDetail
}) {
  const [open, setOpen] = useState(false)
  const commits = item.oids.map(
    (oid) => pr.commits.find((c) => c.oid === oid) ?? { oid, messageHeadline: '' },
  )
  return (
    <div className="px-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <GitCommitHorizontal aria-hidden="true" className="size-3.5" />
        {who(item.author)} pushed {item.count} commit{item.count === 1 ? '' : 's'}
        <span aria-hidden="true">·</span>
        <Time iso={item.createdAt} />
        <ChevronRight
          aria-hidden="true"
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open ? (
        <ul className="mt-1.5 ml-5 flex flex-col gap-1 border-l pl-3">
          {commits.map((commit) => (
            <li key={commit.oid} className="flex min-w-0 gap-2 text-xs">
              <span className="shrink-0 font-mono text-muted-foreground">
                {commit.oid.slice(0, 7)}
              </span>
              <span className="truncate">{commit.messageHeadline}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TimelineItem({
  item,
  pr,
  onOpenThreads,
}: {
  item: PrTimelineItem
  pr: PullRequestDetail
  onOpenThreads: (threadId: string | undefined) => void
}) {
  switch (item.kind) {
    case 'comment':
      return <Card author={item.author} createdAt={item.createdAt} bodyHtml={item.bodyHtml} />
    case 'review': {
      const threads = item.threadIds.length
      return (
        <Card
          author={item.author}
          createdAt={item.createdAt}
          bodyHtml={item.bodyHtml}
          empty={threads > 0 ? 'Left comments on the code.' : 'No summary.'}
          action={
            <span
              className={cn('font-medium', REVIEW_TONE[item.state] ?? 'text-muted-foreground')}
            >
              {REVIEW_VERB[item.state] ?? item.state.toLowerCase()}
            </span>
          }
          footer={
            threads === 0 ? undefined : (
              <button
                type="button"
                onClick={() => onOpenThreads(item.threadIds[0])}
                className="flex items-center gap-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <MessageSquare aria-hidden="true" className="size-3.5" />
                {threads} thread{threads === 1 ? '' : 's'} — open in Threads
              </button>
            )
          }
        />
      )
    }
    case 'commits':
      return <CommitsItem item={item} pr={pr} />
    case 'force_push':
      return (
        <EventLine>
          {who(item.author)} force-pushed the branch · <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'ready_for_review':
      return (
        <EventLine>
          {who(item.author)} marked this ready for review · <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'review_requested':
      return (
        <EventLine>
          {who(item.author)} requested a review from {item.reviewer} ·{' '}
          <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'merged':
      return (
        <EventLine>
          <span className="text-status-passed">{who(item.by)} merged this</span> ·{' '}
          <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'closed':
      return (
        <EventLine>
          {who(item.author)} closed this · <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'reopened':
      return (
        <EventLine>
          {who(item.author)} reopened this · <Time iso={item.createdAt} />
        </EventLine>
      )
    case 'renamed':
      return (
        <EventLine>
          {who(item.author)} renamed this from “{item.from}” · <Time iso={item.createdAt} />
        </EventLine>
      )
    default:
      return null
  }
}

/** A conversation comment; ⌘↵ sends. */
function Composer({ projectId, number }: { projectId: string; number: number }) {
  const [body, setBody] = useState('')
  const comment = useAddPrComment(projectId, number)
  const send = () => {
    if (body.trim() === '' || comment.isPending) return
    comment.mutate(
      { body },
      {
        onSuccess: () => setBody(''),
        onError: (error) => toast.error(`Couldn't comment: ${errorMessage(error)}`),
      },
    )
  }
  return (
    <form
      className="flex flex-col gap-2 border-t bg-background px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <label htmlFor="pr-comment" className="sr-only">
        Comment
      </label>
      <Textarea
        id="pr-comment"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            send()
          }
        }}
        placeholder="Leave a comment (markdown)"
        className="min-h-16 resize-y text-[0.8125rem]"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">
          <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd> <Kbd>↵</Kbd> to send
        </span>
        <Button type="submit" size="sm" disabled={body.trim() === '' || comment.isPending}>
          {comment.isPending ? 'Sending…' : 'Comment'}
        </Button>
      </div>
    </form>
  )
}

/** The description, the conversation (newest at the bottom) and a composer. */
export function PrOverviewTab({
  projectId,
  pr,
  onOpenThreads,
}: {
  projectId: string
  pr: PullRequestDetail
  onOpenThreads: (threadId: string | undefined) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Opens at the end, where the latest activity is.
  useEffect(() => {
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [])
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
          <Card
            author={pr.author}
            action={<span className="text-muted-foreground">opened this</span>}
            createdAt={pr.createdAt}
            bodyHtml={pr.bodyHtml}
            empty="No description."
          />
          {pr.timeline.map((item, index) => (
            <TimelineItem
              key={'id' in item ? item.id : `${item.kind}-${item.createdAt}-${index}`}
              item={item}
              pr={pr}
              onOpenThreads={onOpenThreads}
            />
          ))}
          {pr.truncated.timeline ? (
            <EventLine>
              Older activity is on{' '}
              <a href={pr.url} target="_blank" rel="noopener noreferrer" className="underline">
                GitHub
              </a>
              .
            </EventLine>
          ) : null}
        </div>
      </div>
      <Composer projectId={projectId} number={pr.number} />
    </div>
  )
}
