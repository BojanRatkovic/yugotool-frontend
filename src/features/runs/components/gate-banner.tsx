import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  FolderGit2,
  Split,
  MessageSquareReply,
  ScanEye,
  Settings2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ReadButton } from '@/components/markdown-reader'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SkillTextarea } from '@/components/skill-textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGateDecision } from '@/features/runs/api/run-queries'
import { effectiveDelivery } from '@/features/runs/utils/delivery'
import { splitRoute } from '@/features/runs/utils/hub-plan'
import { gateRequest } from '@/features/runs/utils/gate-decision'
import type { RequestChangesCopy } from '@/features/runs/utils/request-changes'
import { errorMessage } from '@/lib/api-client'
import type { DeliveryMode, GateDecision, ProjectSkill, SplitItem } from '@/lib/contracts'
import { DELIVERY_MODES, DELIVERY_OPTIONS, isPrMode } from '@/lib/delivery'
import { IS_MAC } from '@/lib/shortcuts'

type Decision = GateDecision['decision']

const DONE_TOAST: Record<Decision, (stationName: string) => string> = {
  approve: (name) => `Approved ${name}.`,
  reject: (name) => `Rejected ${name}.`,
  request_changes: (name) => `Sent ${name} back to the builder.`,
}

/** "Approved Review." or, with a delivery, "Approved Review · opening a draft PR." */
function decisionToast(
  decision: Decision,
  stationName: string,
  delivery: DeliveryMode | undefined,
): string {
  const done = DONE_TOAST[decision](stationName)
  return delivery === undefined
    ? done
    : `${done.slice(0, -1)} · ${DELIVERY_OPTIONS[delivery].outcome}.`
}

const KBD_CLASS = 'h-4 bg-primary-foreground/15 text-primary-foreground/80'

/** The plan gate of a hub run, before its worktree exists (spec 0014). */
export interface HubPlanGate {
  repos: string[]
  /** Where the select starts: preset, else Research's pick; null = none named. */
  suggested: string | null
  /** Research's proposed split, if any. */
  split: SplitItem[] | null
  /** The split was created (the work order has followers). */
  splitDone: boolean
  splitting: boolean
  onCreateSplit: () => void
}

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
  hub,
  skills,
  reading,
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
  /** A hub run's plan gate: pick the repo, accept a split. */
  hub?: HubPlanGate
  /** The project's skills: `/` in the comment offers them (spec 0015). */
  skills?: readonly ProjectSkill[]
  /** What this gate approves (the plan, the summary), opened in the reader. */
  reading?: { stationName: string; text: string } | null
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
  const [repo, setRepo] = useState<string | null>(hub?.suggested ?? null)
  // A created split puts this work order on its first item's repo.
  const splitHead = hub?.splitDone === true ? (hub.split?.[0]?.repo ?? null) : null
  const chosenRepo = splitHead ?? repo

  function submit(decision: Decision, mode: DeliveryMode | undefined = delivery) {
    if (decide.isPending) return
    const request = gateRequest({
      decision,
      comment,
      delivery: mode,
      canRequestChanges: requestChanges !== null,
      repo: hub === undefined ? undefined : chosenRepo,
    })
    if (request.kind === 'none') return
    if (request.kind === 'needs_comment') {
      setCommentError(
        `Say what should change — ${requestChanges?.target ?? 'the station'} resumes from your comment.`,
      )
      commentRef.current?.focus()
      return
    }
    if (request.kind === 'needs_repo') {
      toast.error('Pick the repo this work goes in.')
      return
    }
    decide.mutate(
      { stationKey, ...request.body },
      {
        onSuccess: () => {
          setComment('')
          toast.success(decisionToast(decision, stationName, request.delivery))
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
          <GateTitle
            stationName={stationName}
            prompt={prompt}
            qaReview={qaReview}
            reading={reading ?? null}
          />
          {hub === undefined ? null : (
            <HubPlanBlock
              hub={hub}
              repo={chosenRepo}
              locked={splitHead !== null}
              onRepo={setRepo}
              idPrefix={commentId}
            />
          )}
          <Label htmlFor={commentId} className="sr-only">
            Comment
          </Label>
          <SkillTextarea
            ref={commentRef}
            id={commentId}
            value={comment}
            skills={skills}
            onValueChange={(next) => {
              setComment(next)
              if (commentError !== null && next.trim() !== '') setCommentError(null)
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
          <DecisionButtons
            idPrefix={commentId}
            delivery={delivery}
            projectDefault={projectDefault}
            prBlockedReason={prBlockedReason}
            requestChanges={requestChanges}
            pending={decide.isPending}
            onDecide={submit}
            onChangeDefault={onChangeDefault}
          />
          {effective?.fellBack === true && projectDefault !== undefined ? (
            <FallbackNote projectDefault={projectDefault} reason={prBlockedReason} />
          ) : null}
        </div>
      </div>
    </section>
  )
}

/** "Needs you · Station", the gate's prompt, and the QA shortcut when there are results. */
function GateTitle({
  stationName,
  prompt,
  qaReview,
  reading,
}: {
  stationName: string
  prompt: string | null
  qaReview: { diffs: number; onOpen: () => void } | undefined
  reading: { stationName: string; text: string } | null
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold">
          <span className="text-status-waiting">Needs you</span>
          <span className="text-muted-foreground"> · </span>
          {stationName}
        </p>
        {reading === null ? null : (
          <ReadButton
            label={`Read ${reading.stationName}`}
            title={`${reading.stationName} · for ${stationName}`}
            description="The answer this gate asks you to approve"
            text={reading.text}
            size="sm"
            variant="outline"
            className="h-7 bg-background"
          />
        )}
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
  )
}

const modKey = IS_MAC ? '⌘' : 'Ctrl'

/** Approve (a split button at the final gate), Request changes, Reject. */
function DecisionButtons({
  idPrefix,
  delivery,
  projectDefault,
  prBlockedReason,
  requestChanges,
  pending,
  onDecide,
  onChangeDefault,
}: {
  idPrefix: string
  /** The delivery Approve uses; undefined when this gate doesn't deliver. */
  delivery: DeliveryMode | undefined
  projectDefault: DeliveryMode | undefined
  prBlockedReason: string | null
  requestChanges: RequestChangesCopy | null
  pending: boolean
  onDecide: (decision: Decision, mode?: DeliveryMode) => void
  onChangeDefault: (() => void) | undefined
}) {
  return (
    // Wraps in a narrow panel: Reject must never slide under the details rail.
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => onDecide('approve')}
          className={delivery === undefined ? undefined : 'rounded-r-none border-r-0'}
        >
          <Check aria-hidden="true" />
          {delivery === undefined ? 'Approve' : DELIVERY_OPTIONS[delivery].approveLabel}
          <KbdGroup className="ml-1">
            <Kbd className={KBD_CLASS}>{modKey}</Kbd>
            <Kbd className={KBD_CLASS}>↵</Kbd>
          </KbdGroup>
        </Button>
        {delivery === undefined ? null : (
          <DeliveryMenu
            projectDefault={projectDefault ?? delivery}
            prBlockedReason={prBlockedReason}
            disabled={pending}
            onPick={(mode) => onDecide('approve', mode)}
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
              disabled={pending}
              onClick={() => onDecide('request_changes')}
              aria-describedby={`${idPrefix}-rc-hint`}
              className="bg-background"
            >
              <MessageSquareReply aria-hidden="true" />
              Request changes
              <KbdGroup className="ml-1">
                <Kbd className="h-4">{modKey}</Kbd>
                <Kbd className="h-4">⇧</Kbd>
                <Kbd className="h-4">↵</Kbd>
              </KbdGroup>
            </Button>
          </TooltipTrigger>
          <TooltipContent id={`${idPrefix}-rc-hint`} className="max-w-72">
            {requestChanges.hint}
          </TooltipContent>
        </Tooltip>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => onDecide('reject')}
        className="border-status-failed/40 text-status-failed hover:bg-status-failed-soft hover:text-status-failed"
      >
        <X aria-hidden="true" />
        Reject
      </Button>
    </div>
  )
}

/** The project wants a PR, but PRs can't work here: approving commits locally. */
function FallbackNote({
  projectDefault,
  reason,
}: {
  projectDefault: DeliveryMode
  reason: string | null
}) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-status-queued" />
      <span>
        The project default is “{DELIVERY_OPTIONS[projectDefault].menuLabel}”, but PRs
        aren&rsquo;t possible. {reason} Approving commits locally.
      </span>
    </p>
  )
}

/** Repo select and, when Research proposed one, the split into a chain of work orders. */
function HubPlanBlock({
  hub,
  repo,
  locked,
  onRepo,
  idPrefix,
}: {
  hub: HubPlanGate
  repo: string | null
  /** Set by a created split: the repo is its first item's. */
  locked: boolean
  onRepo: (repo: string) => void
  idPrefix: string
}) {
  const selectId = `${idPrefix}-repo`
  const split = hub.split
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={selectId} className="flex items-center gap-1.5 text-[0.8125rem]">
          <FolderGit2 aria-hidden="true" className="size-3.5 text-muted-foreground" />
          Repo
        </Label>
        <Select value={repo ?? undefined} onValueChange={onRepo} disabled={locked}>
          <SelectTrigger
            id={selectId}
            size="sm"
            className="w-60 bg-background font-mono text-xs"
          >
            <SelectValue placeholder="Pick the repo" />
          </SelectTrigger>
          <SelectContent>
            {hub.repos.map((name) => (
              <SelectItem key={name} value={name} className="font-mono text-xs">
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {hub.suggested === null
            ? 'Research named no repo: pick one to approve.'
            : 'The worktree is made here after you approve.'}
        </span>
      </div>
      {split === null || split.length < 2 ? null : (
        <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Split aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-[0.8125rem] font-medium">
              Research suggests {split.length} work orders
              <span className="font-mono text-xs font-normal text-muted-foreground">
                {' '}
                · {splitRoute(split)}
              </span>
            </p>
            {hub.splitDone ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-status-passed">
                <Check aria-hidden="true" className="size-3.5" />
                Created
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 shrink-0"
                disabled={hub.splitting}
                onClick={hub.onCreateSplit}
              >
                Create them
              </Button>
            )}
          </div>
          <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-xs text-muted-foreground">
            {split.map((item, index) => (
              <li key={`${index}-${item.title}`}>
                <span className="text-foreground">{item.title}</span>
                <span className="font-mono"> · {item.repo}</span>
                {index === 0
                  ? ' · this work order'
                  : ' · starts after the previous one is delivered'}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
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
