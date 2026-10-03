import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { TONE_SOFT, TONE_TEXT, type Tone } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useReplyToThread, useResolveThread } from '@/features/pull-requests/api/pr-mutations'
import {
  findingPlace,
  fixedReply,
  previousCounts,
  type PreviousRow,
  stillOpenReply,
} from '@/features/pull-requests/utils/zastava'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

const STATUS: Record<PreviousRow['status'], { label: string; tone: Tone | null }> = {
  fixed: { label: 'Fixed', tone: 'passed' },
  partly: { label: 'Partly', tone: 'waiting' },
  open: { label: 'Still open', tone: 'failed' },
  unchecked: { label: 'Not checked', tone: null },
}

/** Fixed + open thread: resolve it, optionally saying where it was fixed first. */
function ResolveThread({
  projectId,
  number,
  threadId,
  headOid,
}: {
  projectId: string
  number: number
  threadId: string
  headOid: string
}) {
  const [withReply, setWithReply] = useState(true)
  const [done, setDone] = useState(false)
  const reply = useReplyToThread(projectId, number)
  const resolve = useResolveThread(projectId, number)
  const pending = reply.isPending || resolve.isPending
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] text-status-passed">
        <Check aria-hidden="true" className="size-3.5" />
        Resolved
      </span>
    )
  }
  const resolveNow = () =>
    resolve.mutate(
      { threadId, resolved: true },
      {
        onSuccess: () => setDone(true),
        onError: (error) => toast.error(`Couldn't resolve: ${errorMessage(error)}`),
      },
    )
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!withReply) return resolveNow()
          reply.mutate(
            { threadId, body: fixedReply(headOid) },
            {
              onSuccess: resolveNow,
              onError: (error) => toast.error(`Couldn't reply: ${errorMessage(error)}`),
            },
          )
        }}
      >
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        Resolve thread
      </Button>
      <label className="flex items-center gap-1.5 text-[0.75rem] text-muted-foreground">
        <input
          type="checkbox"
          checked={withReply}
          onChange={(event) => setWithReply(event.target.checked)}
          className="size-3.5 accent-primary"
        />
        Reply “{fixedReply(headOid)}” first
      </label>
    </div>
  )
}

/** Open or partly + thread: a "still open" reply, prefilled with the re-review's note. */
function ReplyStillOpen({
  projectId,
  number,
  threadId,
  row,
}: {
  projectId: string
  number: number
  threadId: string
  row: PreviousRow
}) {
  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState(() => stillOpenReply(row))
  const [sent, setSent] = useState(false)
  const reply = useReplyToThread(projectId, number)
  if (sent) {
    return <span className="text-[0.75rem] text-muted-foreground">Replied on GitHub</span>
  }
  if (!composing) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={() => setComposing(true)}
      >
        Reply “still open”
      </Button>
    )
  }
  const send = () => {
    if (body.trim() === '' || reply.isPending) return
    reply.mutate(
      { threadId, body },
      {
        onSuccess: () => setSent(true),
        onError: (error) => toast.error(`Couldn't reply: ${errorMessage(error)}`),
      },
    )
  }
  return (
    <div className="flex max-w-2xl flex-col gap-2">
      <Textarea
        aria-label="Reply"
        ref={(el) => el?.focus()}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setComposing(false)
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send()
        }}
        className="min-h-16 text-[0.8125rem]"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={body.trim() === '' || reply.isPending} onClick={send}>
          {reply.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : null}
          Send reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
          Cancel
        </Button>
        <span className="text-[0.6875rem] text-muted-foreground">
          Goes out now as a thread reply, not with your pending review.
        </span>
      </div>
    </div>
  )
}

function PreviousFindingRow({
  projectId,
  number,
  headOid,
  row,
  onOpenFile,
}: {
  projectId: string
  number: number
  headOid: string
  row: PreviousRow
  onOpenFile: (file: string) => void
}) {
  const { finding } = row
  const status = STATUS[row.status]
  const place = findingPlace({ ...finding, startLine: null })
  const threadOpen = finding.threadId !== null && finding.threadResolved !== true
  return (
    <li className="flex flex-col gap-1.5 border-b px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.6875rem] font-medium',
            status.tone === null
              ? 'bg-muted text-muted-foreground'
              : [TONE_SOFT[status.tone], TONE_TEXT[status.tone]],
          )}
        >
          {status.label}
        </span>
        <span className="truncate text-[0.8125rem] font-medium">{finding.title}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
        <span>{finding.severity}</span>
        {place === null || finding.file === null ? (
          <span>whole PR</span>
        ) : (
          <button
            type="button"
            onClick={() => onOpenFile(finding.file ?? '')}
            className="truncate underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            title="Open in Files"
          >
            {place}
          </button>
        )}
        {finding.threadId !== null && finding.threadResolved === true ? (
          <span>· thread resolved</span>
        ) : null}
        {!finding.posted ? <span>· not posted</span> : null}
      </div>
      {row.note === '' ? null : <p className="text-[0.8125rem]">{row.note}</p>}
      {finding.threadId !== null && threadOpen && row.status === 'fixed' ? (
        <ResolveThread
          projectId={projectId}
          number={number}
          threadId={finding.threadId}
          headOid={headOid}
        />
      ) : null}
      {finding.threadId !== null &&
      threadOpen &&
      (row.status === 'open' || row.status === 'partly') ? (
        <ReplyStillOpen
          projectId={projectId}
          number={number}
          threadId={finding.threadId}
          row={row}
        />
      ) : null}
    </li>
  )
}

/** A re-review's answer to "did they fix what I asked for?" (spec 0010). */
export function PrPreviousFindings({
  projectId,
  number,
  headOid,
  rows,
  onOpenFile,
}: {
  projectId: string
  number: number
  /** The re-reviewed commit: what "Fixed in" points at. */
  headOid: string
  rows: PreviousRow[]
  onOpenFile: (file: string) => void
}) {
  return (
    <section aria-labelledby="since-last-review" className="border-b">
      <div className="flex items-baseline gap-2 border-b bg-muted/40 px-4 py-2">
        <h3 id="since-last-review" className="text-[0.8125rem] font-semibold">
          Since your last review
        </h3>
        <span className="text-xs text-muted-foreground">{previousCounts(rows)}</span>
      </div>
      <ul aria-label="Previous findings">
        {rows.map((row) => (
          <PreviousFindingRow
            key={row.finding.id}
            projectId={projectId}
            number={number}
            headOid={headOid}
            row={row}
            onOpenFile={onOpenFile}
          />
        ))}
      </ul>
    </section>
  )
}
