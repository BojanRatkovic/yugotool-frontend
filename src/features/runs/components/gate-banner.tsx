import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  MessageSquareReply,
  ScanEye,
  Settings2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGateDecision } from '@/features/runs/api/run-queries'
import { effectiveDelivery } from '@/features/runs/utils/delivery'
import type { RequestChangesCopy } from '@/features/runs/utils/request-changes'
import { errorMessage } from '@/lib/api-client'
import type { DeliveryMode, GateDecision } from '@/lib/contracts'
import { DELIVERY_MODES, DELIVERY_OPTIONS, isPrMode } from '@/lib/delivery'
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
  delivery: projectDefault,
  prBlockedReason = null,
  onChangeDefault,
  requestChanges,
}: {
  runId: string
  stationKey: string
  stationName: string
  prompt: string | null
  focusOnMount?: boolean
  /** The run has QA results: link to the QA tab with the diff count. */
  qaReview?: { diffs: number; onOpen: () => void }
  /**
   * Set at the last gate (delivery follows it): the project's default mode.
   * Approve becomes a split button that names the outcome; the menu offers the others.
   */
  delivery?: DeliveryMode
  /** Why draft/ready PRs can't work for this repo; those options are disabled. */
  prBlockedReason?: string | null
  /** Opens project settings on Delivery ("Change project default…"). */
  onChangeDefault?: () => void
  /** Where Request changes sends the work; null hides it (nothing before this gate). */
  requestChanges: RequestChangesCopy | null
}) {
  // A PR default that can't work falls back to a local commit, and says so below the buttons.
  const effective =
    projectDefault === undefined
      ? undefined
      : effectiveDelivery(projectDefault, prBlockedReason)
  const delivery = effective?.mode
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const decide = useGateDecision(runId)
  const sectionRef = useRef<HTMLElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const commentId = `gate-comment-${stationKey}`

  function submit(decision: Decision, mode: DeliveryMode | undefined = delivery) {
    if (decide.isPending) return
    if (decision === 'request_changes' && requestChanges === null) return
    if (decision === 'request_changes' && comment.trim() === '') {
      setCommentError(
        `Say what should change — ${requestChanges?.target ?? 'the station'} resumes from your comment.`,
      )
      commentRef.current?.focus()
      return
    }
    const choice = decision === 'approve' ? mode : undefined
    decide.mutate(
      { stationKey, decision, comment, ...(choice === undefined ? {} : { delivery: choice }) },
      {
        onSuccess: () => {
          setComment('')
          const done = DONE_TOAST[decision](stationName)
          toast.success(
            choice === undefined
              ? done
              : `${done.slice(0, -1)} · ${DELIVERY_OPTIONS[choice].outcome}.`,
          )
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
            placeholder={requestChanges?.placeholder ?? 'Comment (optional)'}
            rows={2}
            className="min-h-14 resize-none bg-background text-[0.8125rem]"
          />
          {commentError === null ? null : (
            <p id={`${commentId}-error`} className="-mt-1 text-xs text-destructive">
              {commentError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => submit('approve')}
                className={delivery === undefined ? undefined : 'rounded-r-none border-r-0'}
              >
                <Check aria-hidden="true" />
                {delivery === undefined ? 'Approve' : DELIVERY_OPTIONS[delivery].approveLabel}
                <KbdGroup className="ml-1">
                  <Kbd className={KBD_CLASS}>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
                  <Kbd className={KBD_CLASS}>↵</Kbd>
                </KbdGroup>
              </Button>
              {delivery === undefined ? null : (
                <DeliveryMenu
                  projectDefault={projectDefault ?? delivery}
                  prBlockedReason={prBlockedReason}
                  disabled={decide.isPending}
                  onPick={(mode) => submit('approve', mode)}
                  onChangeDefault={onChangeDefault}
                />
              )}
            </div>
            {requestChanges === null ? null : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => submit('request_changes')}
                    aria-describedby={`${commentId}-rc-hint`}
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
                </TooltipTrigger>
                <TooltipContent id={`${commentId}-rc-hint`} className="max-w-72">
                  {requestChanges.hint}
                </TooltipContent>
              </Tooltip>
            )}
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
          {effective?.fellBack === true && projectDefault !== undefined ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CircleAlert
                aria-hidden="true"
                className="size-3.5 shrink-0 text-status-queued"
              />
              <span>
                The project default is “{DELIVERY_OPTIONS[projectDefault].menuLabel}”, but PRs
                aren&rsquo;t possible. {prBlockedReason} Approving commits locally.
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** The chevron half of the approve split button: approve with a different delivery. */
function DeliveryMenu({
  projectDefault,
  prBlockedReason,
  disabled,
  onPick,
  onChangeDefault,
}: {
  projectDefault: DeliveryMode
  prBlockedReason: string | null
  disabled: boolean
  onPick: (mode: DeliveryMode) => void
  onChangeDefault?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          disabled={disabled}
          aria-label="Approve with a different delivery"
          // The base button's transparent border + bg-clip-padding would let the page show
          // through the seam; drop it and draw the divider over the button's own fill.
          className="relative rounded-l-none border-l-0 px-1.5 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-primary-foreground/20"
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Approve and…
        </DropdownMenuLabel>
        {DELIVERY_MODES.map((mode) => {
          const blocked = prBlockedReason !== null && isPrMode(mode)
          return (
            <DropdownMenuItem
              key={mode}
              disabled={blocked}
              onSelect={() => onPick(mode)}
              className="flex-col items-start gap-0.5"
            >
              <span className="flex w-full items-center gap-2 text-[0.8125rem] font-medium">
                {DELIVERY_OPTIONS[mode].menuLabel}
                {mode === projectDefault ? (
                  <span className="ml-auto rounded-sm bg-muted px-1.5 text-[0.6875rem] font-normal text-muted-foreground">
                    Project default
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {blocked ? prBlockedReason : DELIVERY_OPTIONS[mode].hint}
              </span>
            </DropdownMenuItem>
          )
        })}
        {onChangeDefault === undefined ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onChangeDefault} className="text-xs">
              <Settings2 aria-hidden="true" />
              Change project default…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
