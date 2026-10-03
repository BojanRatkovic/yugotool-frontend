import { Check, Clock, MessageSquareReply, ScanEye, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useGateDecision } from '@/features/runs/api/run-queries'
import { errorMessage } from '@/lib/api-client'
import type { GateDecision } from '@/lib/contracts'
import { IS_MAC } from '@/lib/shortcuts'

type Decision = GateDecision['decision']

const DONE_TOAST: Record<Decision, (stationName: string) => string> = {
  approve: (name) => `Approved ${name}.`,
  reject: (name) => `Rejected ${name}.`,
  request_changes: (name) => `Sent ${name} back to the builder.`,
}

const KBD_CLASS = 'h-4 bg-primary-foreground/15 text-primary-foreground/80'

/**
 * Sticky decision bar for a gate that awaits a human. `⌘↵` approves,
 * `⌘⇧↵` requests changes (a comment is required for that one).
 * `focusOnMount` scrolls it into view and focuses the comment — used when the
 * panel opens on a pending gate (e.g. from a notification deep link).
 */
export function GateBanner({
  runId,
  stationKey,
  stationName,
  prompt,
  focusOnMount = false,
  qaReview,
  approveLabel = 'Approve',
}: {
  runId: string
  stationKey: string
  stationName: string
  prompt: string | null
  focusOnMount?: boolean
  /** The run has QA results: link to the QA tab with the diff count. */
  qaReview?: { diffs: number; onOpen: () => void }
  /** e.g. "Approve & commit locally" on a local-only project's final gate. */
  approveLabel?: string
}) {
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const decide = useGateDecision(runId)
  const sectionRef = useRef<HTMLElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentId = `gate-comment-${stationKey}`

  function submit(decision: Decision) {
    if (decide.isPending) return
    if (decision === 'request_changes' && comment.trim() === '') {
      setCommentError('Say what should change — the builder resumes from your comment.')
      commentRef.current?.focus()
      return
    }
    decide.mutate(
      { stationKey, decision, comment },
      {
        onSuccess: () => {
          setComment('')
          toast.success(DONE_TOAST[decision](stationName))
        },
        onError: (error) => toast.error(`Couldn't submit the decision: ${errorMessage(error)}`),
      },
    )
  }

  // Shortcuts work from anywhere in the panel, including the comment field.
  const submitRef = useRef<(decision: Decision) => void>(() => {})
  useEffect(() => {
    submitRef.current = submit
  })
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.defaultPrevented)
        return
      event.preventDefault()
      submitRef.current(event.shiftKey ? 'request_changes' : 'approve')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!focusOnMount) return
    sectionRef.current?.scrollIntoView({ block: 'nearest' })
    // Don't steal focus from a field the user is already typing in.
    const active = document.activeElement
    const idle =
      active === null ||
      active === document.body ||
      (active instanceof HTMLElement && active.getAttribute('role') === 'dialog')
    if (idle) commentRef.current?.focus({ preventScroll: true })
  }, [focusOnMount])

  return (
    <section
      ref={sectionRef}
      aria-label={`${stationName} needs your decision`}
      className="border-b border-status-waiting/25 bg-status-waiting-soft px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-waiting" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-sm font-semibold">
                <span className="text-status-waiting">Needs you</span>
                <span className="text-muted-foreground"> · </span>
                {stationName}
              </p>
              {qaReview === undefined ? null : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 bg-background"
                  onClick={qaReview.onOpen}
                >
                  <ScanEye aria-hidden="true" />
                  Review QA
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    ({qaReview.diffs === 1 ? '1 diff' : `${qaReview.diffs} diffs`})
                  </span>
                </Button>
              )}
            </div>
            {prompt === null || prompt === '' ? null : (
              <p className="text-[0.8125rem] text-muted-foreground">{prompt}</p>
            )}
          </div>
          <Label htmlFor={commentId} className="sr-only">
            Comment
          </Label>
          <Textarea
            ref={commentRef}
            id={commentId}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value)
              if (commentError !== null && event.target.value.trim() !== '')
                setCommentError(null)
            }}
            aria-invalid={commentError === null ? undefined : true}
            aria-describedby={commentError === null ? undefined : `${commentId}-error`}
            placeholder="Comment (optional · required for Request changes)"
            rows={2}
            className="min-h-14 resize-none bg-background text-[0.8125rem]"
          />
          {commentError === null ? null : (
            <p id={`${commentId}-error`} className="-mt-1 text-xs text-destructive">
              {commentError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={decide.isPending} onClick={() => submit('approve')}>
              <Check aria-hidden="true" />
              {approveLabel}
              <KbdGroup className="ml-1">
                <Kbd className={KBD_CLASS}>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd className={KBD_CLASS}>↵</Kbd>
              </KbdGroup>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => submit('request_changes')}
              className="bg-background"
            >
              <MessageSquareReply aria-hidden="true" />
              Request changes
              <KbdGroup className="ml-1">
                <Kbd className="h-4">{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd className="h-4">⇧</Kbd>
                <Kbd className="h-4">↵</Kbd>
              </KbdGroup>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => submit('reject')}
              className="border-status-failed/40 text-status-failed hover:bg-status-failed-soft hover:text-status-failed"
            >
              <X aria-hidden="true" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
