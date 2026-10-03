import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useSubmitReview } from '@/features/pull-requests/api/pr-mutations'
import { pendingComments } from '@/features/pull-requests/utils/threads'
import { errorMessage } from '@/lib/api-client'
import type { PrSubmitReviewInput, PullRequestDetail } from '@/lib/contracts'
import { IS_MAC } from '@/lib/shortcuts'

export type ReviewEvent = PrSubmitReviewInput['event']

const EVENTS: { value: ReviewEvent; label: string; hint: string }[] = [
  { value: 'COMMENT', label: 'Comment', hint: 'Feedback without approving.' },
  { value: 'APPROVE', label: 'Approve', hint: 'Good to merge.' },
  { value: 'REQUEST_CHANGES', label: 'Request changes', hint: 'Must change before merging.' },
]

/**
 * Submits my review: approve / request changes / comment, a summary, and my
 * pending line comments. Authors can only comment on their own PR.
 */
export function PrReviewDialog({
  projectId,
  pr,
  isAuthor,
  initialEvent,
  open,
  onOpenChange,
}: {
  projectId: string
  pr: PullRequestDetail
  isAuthor: boolean
  initialEvent: ReviewEvent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [event, setEvent] = useState<ReviewEvent>(isAuthor ? 'COMMENT' : initialEvent)
  const [body, setBody] = useState('')
  const submit = useSubmitReview(projectId, pr.number)
  const pending = pendingComments(pr)
  const events = isAuthor ? EVENTS.filter((e) => e.value === 'COMMENT') : EVENTS
  const needsWords = event !== 'APPROVE' && body.trim() === '' && pending.length === 0
  const send = () => {
    if (needsWords || submit.isPending) return
    submit.mutate(
      { event, body },
      {
        onSuccess: () => {
          toast.success(
            event === 'APPROVE'
              ? 'Approved.'
              : event === 'REQUEST_CHANGES'
                ? 'Changes requested.'
                : 'Review sent.',
          )
          setBody('')
          onOpenChange(false)
        },
        onError: (error) => toast.error(`Couldn't submit the review: ${errorMessage(error)}`),
      },
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review #{pr.number}</DialogTitle>
          <DialogDescription>
            {pending.length === 0
              ? 'No line comments yet: the summary is the review.'
              : `${pending.length} pending comment${pending.length === 1 ? '' : 's'} go out with it.`}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          {events.length > 1 ? (
            <RadioGroup
              value={event}
              onValueChange={(value) =>
                setEvent(EVENTS.find((e) => e.value === value)?.value ?? 'COMMENT')
              }
              className="gap-2"
            >
              {events.map((e) => (
                <div key={e.value} className="flex items-start gap-2">
                  <RadioGroupItem value={e.value} id={`review-${e.value}`} className="mt-0.5" />
                  <Label
                    htmlFor={`review-${e.value}`}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="text-sm">{e.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{e.hint}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="review-summary" className="text-xs">
              Summary {event === 'APPROVE' ? '(optional)' : null}
            </Label>
            <Textarea
              id="review-summary"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Leave a summary (markdown)"
              className="min-h-24 text-[0.8125rem]"
            />
            {needsWords ? (
              <p className="text-xs text-muted-foreground">
                {event === 'REQUEST_CHANGES'
                  ? 'Say what needs to change: a summary or a line comment.'
                  : 'Add a summary or a line comment.'}
              </p>
            ) : null}
          </div>
          {pending.length === 0 ? null : (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border bg-muted/30 p-2">
              {pending.map((c) => (
                <li key={c.id} className="flex min-w-0 gap-2 text-xs">
                  <span className="shrink-0 font-mono text-muted-foreground">{c.where}</span>
                  <span className="truncate">{c.text}</span>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="items-center">
            <span className="mr-auto text-xs text-muted-foreground">
              <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd> <Kbd>↵</Kbd> submits
            </span>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={needsWords || submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit review'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
