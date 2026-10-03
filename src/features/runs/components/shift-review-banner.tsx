import { useQuery } from '@tanstack/react-query'
import { Clock, OctagonX, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { shiftQueries, useShiftReview } from '@/features/runs/api/shift-queries'
import { draftToHandoff, handoffToDraft, type HandoffDraft } from '@/features/runs/utils/shifts'
import { errorMessage } from '@/lib/api-client'
import type { Shift } from '@/lib/contracts'
import { IS_MAC } from '@/lib/shortcuts'

const KBD_CLASS = 'h-4 bg-primary-foreground/15 text-primary-foreground/80'

const FIELDS: {
  key: keyof HandoffDraft
  label: string
  hint?: string
  rows: number
  mono?: boolean
}[] = [
  { key: 'summary', label: 'Summary', rows: 2 },
  { key: 'done', label: 'Done', hint: 'one per line', rows: 3 },
  { key: 'inProgress', label: 'In progress', rows: 2 },
  { key: 'nextSteps', label: 'Next steps', hint: 'one per line, in order', rows: 3 },
  { key: 'gotchas', label: 'Gotchas', hint: 'one per line', rows: 2 },
  {
    key: 'filesToRead',
    label: 'Files to read',
    hint: 'one path per line',
    rows: 2,
    mono: true,
  },
]

/**
 * Shown while a shift station waits for a human between shifts. Picks the
 * shift awaiting review from the run's shifts; renders nothing until it loads.
 */
export function ShiftReviewBanner({
  runId,
  stationKey,
  stationName,
}: {
  runId: string
  stationKey: string
  stationName: string
}) {
  const shifts = useQuery(shiftQueries.list(runId))
  const shift = shifts.data?.findLast(
    (s) => s.stationKey === stationKey && s.status === 'awaiting_review',
  )
  if (shift === undefined) return null
  return <ReviewForm key={shift.id} runId={runId} shift={shift} stationName={stationName} />
}

function ReviewForm({
  runId,
  shift,
  stationName,
}: {
  runId: string
  shift: Shift
  stationName: string
}) {
  const initial = handoffToDraft(shift.handoff)
  const [draft, setDraft] = useState<HandoffDraft>(initial)
  const review = useShiftReview(runId)
  const sectionRef = useRef<HTMLElement>(null)
  const edited = FIELDS.some(({ key }) => initial[key] !== draft[key])

  function submit(decision: 'continue' | 'stop') {
    if (review.isPending) return
    review.mutate(edited ? { decision, handoff: draftToHandoff(draft) } : { decision }, {
      onSuccess: () =>
        toast.success(
          decision === 'continue'
            ? `Shift ${shift.number + 1} starts${edited ? ' with your edits' : ''}.`
            : `Stopped ${stationName} after shift ${shift.number}.`,
        ),
      onError: (error) => toast.error(`Couldn't submit the review: ${errorMessage(error)}`),
    })
  }

  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.defaultPrevented)
        return
      event.preventDefault()
      submitRef.current('continue')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  const fieldId = (key: string) => `handoff-${shift.id}-${key}`

  return (
    <section
      ref={sectionRef}
      aria-label={`${stationName} handoff needs your review`}
      className="max-h-[60vh] scrollbar-thin overflow-y-auto border-b border-status-waiting/25 bg-status-waiting-soft px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-waiting" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">
              <span className="text-status-waiting">Needs you</span>
              <span className="text-muted-foreground"> · </span>
              {stationName}
              <span className="text-muted-foreground"> · </span>
              <span className="font-mono font-normal tabular-nums">
                shift {shift.number} → {shift.number + 1}
              </span>
            </p>
            <p className="text-[0.8125rem] text-muted-foreground">
              Review the handoff. Your edits replace it and go into the next shift&rsquo;s
              prompt.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 lg:grid-cols-2">
            {FIELDS.map((field) => (
              <div
                key={field.key}
                className={
                  field.key === 'summary'
                    ? 'flex flex-col gap-1 lg:col-span-2'
                    : 'flex flex-col gap-1'
                }
              >
                <Label htmlFor={fieldId(field.key)} className="text-xs">
                  {field.label}
                  {field.hint === undefined ? null : (
                    <span className="font-normal text-muted-foreground"> · {field.hint}</span>
                  )}
                </Label>
                <Textarea
                  id={fieldId(field.key)}
                  value={draft[field.key]}
                  rows={field.rows}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className={
                    field.mono === true
                      ? 'min-h-0 resize-y bg-background font-mono text-xs'
                      : 'min-h-0 resize-y bg-background text-[0.8125rem]'
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={review.isPending} onClick={() => submit('continue')}>
              <Play aria-hidden="true" />
              {edited ? 'Continue with edits' : 'Continue'}
              <KbdGroup className="ml-1">
                <Kbd className={KBD_CLASS}>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd className={KBD_CLASS}>↵</Kbd>
              </KbdGroup>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={review.isPending}
              onClick={() => submit('stop')}
              className="border-status-failed/40 text-status-failed hover:bg-status-failed-soft hover:text-status-failed"
            >
              <OctagonX aria-hidden="true" />
              Stop
            </Button>
            {edited ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={review.isPending}
                onClick={() => setDraft(initial)}
              >
                Reset edits
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
