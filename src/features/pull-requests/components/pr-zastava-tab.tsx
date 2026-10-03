import { useQuery } from '@tanstack/react-query'
import { ChevronRight, LoaderCircle, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { TONE_SOFT, TONE_TEXT, type Tone } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  usePostZastavaFindings,
  useStartZastavaReview,
} from '@/features/pull-requests/api/pr-mutations'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { ReviewText } from '@/features/pull-requests/components/review-text'
import {
  defaultSelection,
  findingPlace,
  type FindingEdit,
  postPayload,
} from '@/features/pull-requests/utils/zastava'
import { errorMessage } from '@/lib/api-client'
import type {
  PullRequestDetail,
  ReviewFinding,
  ReviewVerdict,
  ZastavaReview,
} from '@/lib/contracts'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

const RECOMMENDATION: Record<ReviewVerdict['recommendation'], { label: string; tone: Tone }> = {
  approve: { label: 'Looks good', tone: 'passed' },
  comment: { label: 'Comments', tone: 'waiting' },
  request_changes: { label: 'Changes needed', tone: 'failed' },
}

const SEVERITY: Record<ReviewFinding['severity'], { label: string; dot: string }> = {
  critical: { label: 'Critical', dot: 'bg-status-failed' },
  important: { label: 'Important', dot: 'bg-status-waiting' },
  minor: { label: 'Minor', dot: 'bg-muted-foreground' },
}

function StartReview({
  projectId,
  pr,
  label,
  note,
}: {
  projectId: string
  pr: PullRequestDetail
  label: string
  note: React.ReactNode
}) {
  const start = useStartZastavaReview(projectId, pr.number)
  return (
    <div className="flex flex-col items-start gap-3 p-6">
      <div className="text-[0.8125rem] text-muted-foreground">{note}</div>
      <Button
        size="sm"
        disabled={start.isPending || pr.state !== 'open'}
        onClick={() =>
          start.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })
        }
      >
        {start.isPending ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <ScanSearch aria-hidden="true" />
        )}
        {label}
      </Button>
    </div>
  )
}

/** One finding: pick it, read it, edit what goes to GitHub, jump to its line. */
function FindingRow({
  finding,
  edit,
  picked,
  posted,
  onPick,
  onEdit,
  onOpenFile,
}: {
  finding: ReviewFinding
  edit: FindingEdit
  picked: boolean
  posted: boolean
  onPick: (picked: boolean) => void
  onEdit: (edit: FindingEdit) => void
  onOpenFile: (file: string) => void
}) {
  const [open, setOpen] = useState(finding.severity === 'critical')
  const severity = SEVERITY[finding.severity]
  const place = findingPlace(finding)
  const id = `finding-${finding.id}`
  return (
    <li className={cn('border-b px-4 py-2.5', posted && 'opacity-70')}>
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          aria-label={`Add “${edit.title}” to the pending review`}
          checked={picked || posted}
          disabled={posted}
          onChange={(event) => onPick(event.target.checked)}
          className="mt-1 size-3.5 shrink-0 accent-primary"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', severity.dot)}
            />
            <span className="sr-only">{severity.label}:</span>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
              className="flex min-w-0 items-center gap-1 text-left text-[0.8125rem] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
              />
              <span className="truncate">{edit.title}</span>
            </button>
            {posted ? (
              <span className="shrink-0 rounded-sm bg-status-passed/15 px-1 text-[0.6875rem] text-status-passed">
                On GitHub
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-2 pl-[1.375rem] font-mono text-[0.6875rem] text-muted-foreground">
            <span>{finding.category}</span>
            {place === null ? (
              <span>whole PR</span>
            ) : finding.file !== null ? (
              <button
                type="button"
                onClick={() => onOpenFile(finding.file ?? '')}
                className="truncate underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                title="Open in Files"
              >
                {place}
              </button>
            ) : null}
            {finding.line === null && finding.file !== null ? (
              <span title="Not on a line of the diff: it goes to the review summary">
                · summary
              </span>
            ) : null}
            {finding.confidence === 'medium' ? <span>· medium confidence</span> : null}
          </div>
          {open ? (
            <div id={id} className="flex flex-col gap-2 pt-1.5 pl-[1.375rem]">
              {posted ? (
                <ReviewText text={edit.body} className="text-[0.8125rem]" />
              ) : (
                <>
                  <Input
                    aria-label="Comment title"
                    value={edit.title}
                    onChange={(event) => onEdit({ ...edit, title: event.target.value })}
                    className="h-8 text-[0.8125rem]"
                  />
                  <Textarea
                    aria-label="Comment"
                    value={edit.body}
                    onChange={(event) => onEdit({ ...edit, body: event.target.value })}
                    className="min-h-20 text-[0.8125rem]"
                  />
                  {edit.suggestion === null ? null : (
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] text-muted-foreground">
                        Suggested change (GitHub applies it in one click)
                      </span>
                      <Textarea
                        aria-label="Suggested change"
                        value={edit.suggestion}
                        onChange={(event) =>
                          onEdit({ ...edit, suggestion: event.target.value })
                        }
                        className="min-h-12 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => onEdit({ ...edit, suggestion: null })}
                        className="self-start text-[0.6875rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Drop the suggestion
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** A finished review: summary, findings to pick and edit, and the way to GitHub. */
function Findings({
  projectId,
  pr,
  review,
  verdict,
  onOpenFile,
}: {
  projectId: string
  pr: PullRequestDetail
  review: ZastavaReview
  verdict: ReviewVerdict
  onOpenFile: (file: string) => void
}) {
  const posted = review.pullRequest.posted
  const [selected, setSelected] = useState(() => defaultSelection(verdict.findings, posted))
  const [edits, setEdits] = useState<Record<string, FindingEdit>>({})
  const post = usePostZastavaFindings(projectId, pr.number)
  const rerun = useStartZastavaReview(projectId, pr.number)
  const payload = postPayload(verdict.findings, selected, posted, edits)
  const recommendation = RECOMMENDATION[verdict.recommendation]
  const editOf = (f: ReviewFinding): FindingEdit =>
    edits[f.id] ?? { title: f.title, body: f.body, suggestion: f.suggestion }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col gap-2 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full px-2 font-medium',
                TONE_SOFT[recommendation.tone],
                TONE_TEXT[recommendation.tone],
              )}
            >
              {recommendation.label}
            </span>
            <span>
              Reviewed{' '}
              <span className="font-mono">{review.pullRequest.headOid.slice(0, 7)}</span>
              {review.pullRequest.sinceOid === null ? null : (
                <>
                  {' '}
                  since{' '}
                  <span className="font-mono">{review.pullRequest.sinceOid.slice(0, 7)}</span>
                </>
              )}
            </span>
            <span className="font-mono tabular-nums">{formatUsd(review.costUsd)}</span>
          </div>
          <ReviewText text={verdict.summary} className="max-w-3xl text-[0.8125rem]" />
          {review.stale ? (
            <div className="flex items-center gap-3 rounded-md bg-status-waiting-soft px-3 py-2 text-[0.8125rem]">
              <span className="flex-1">
                New commits were pushed after this review. Lines may have moved, so posting is
                blocked until it runs on the new head.
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={rerun.isPending}
                onClick={() =>
                  rerun.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })
                }
              >
                Re-run on new head
              </Button>
            </div>
          ) : null}
        </section>
        {verdict.findings.length === 0 ? (
          <p className="px-4 py-6 text-[0.8125rem] text-muted-foreground">
            No findings. Nothing here needs a comment.
          </p>
        ) : (
          <ul aria-label="Findings">
            {verdict.findings.map((finding) => (
              <FindingRow
                key={finding.id}
                finding={finding}
                edit={editOf(finding)}
                picked={selected.has(finding.id)}
                posted={posted.includes(finding.id)}
                onPick={(picked) => {
                  const next = new Set(selected)
                  if (picked) next.add(finding.id)
                  else next.delete(finding.id)
                  setSelected(next)
                }}
                onEdit={(edit) => setEdits({ ...edits, [finding.id]: edit })}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        )}
      </div>
      {verdict.findings.length === 0 ? null : (
        <div className="flex items-center gap-3 border-t px-4 py-2 text-[0.8125rem]">
          <span className="text-muted-foreground">
            Goes to your pending review. Nothing is submitted until you use Review.
          </span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={payload.findings.length === 0 || review.stale || post.isPending}
            onClick={() =>
              post.mutate(payload, {
                onSuccess: () =>
                  toast.success(`${payload.findings.length} added to your pending review.`),
                onError: (error) => toast.error(errorMessage(error)),
              })
            }
          >
            {post.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : null}
            Add {payload.findings.length} to pending review
          </Button>
        </div>
      )}
    </div>
  )
}

/** The PR's ZASTAVA review (spec 0009): summary and findings to triage. */
export function PrZastavaTab({
  projectId,
  pr,
  onOpenFile,
}: {
  projectId: string
  pr: PullRequestDetail
  onOpenFile: (file: string) => void
}) {
  const query = useQuery(prQueries.zastavaReview(projectId, pr.number, pr.headOid))
  if (query.data === undefined) {
    return query.error === null ? null : (
      <p className="p-4 text-[0.8125rem] text-status-failed">{errorMessage(query.error)}</p>
    )
  }
  const review = query.data.review
  if (review === null || review.status === 'cancelled' || review.status === 'rejected') {
    return (
      <StartReview
        projectId={projectId}
        pr={pr}
        label="Review with ZASTAVA"
        note={
          <>
            ZASTAVA reviews this PR&apos;s head commit with the project&apos;s review line.
            Findings land here first: you pick and edit what goes to GitHub.{' '}
            <span className="font-mono">Z</span>
          </>
        }
      />
    )
  }
  if (review.status === 'failed') {
    return (
      <StartReview
        projectId={projectId}
        pr={pr}
        label="Review again"
        note={
          <>
            <span className="font-medium text-status-failed">The review failed.</span>{' '}
            {review.error ?? 'See the worker log for why.'}
          </>
        }
      />
    )
  }
  if (review.verdict === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-[0.8125rem] text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        Reviewing <span className="font-mono">{review.pullRequest.headOid.slice(0, 7)}</span>…
        <span className="font-mono tabular-nums">{formatUsd(review.costUsd)}</span>
      </div>
    )
  }
  return (
    <Findings
      // Fresh picks and edits per review.
      key={review.workOrderId}
      projectId={projectId}
      pr={pr}
      review={review}
      verdict={review.verdict}
      onOpenFile={onOpenFile}
    />
  )
}
