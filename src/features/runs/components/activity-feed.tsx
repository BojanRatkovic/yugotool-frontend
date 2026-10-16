import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Braces,
  ChevronRight,
  CircleCheck,
  CircleX,
  FilePen,
  FileText,
  Globe,
  Image as ImageIcon,
  Info,
  MessageSquareReply,
  Search,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { memo, useState, type ReactNode } from 'react'

import { useStickToBottom } from '@/hooks/use-stick-to-bottom'

import { CodeBlock, CodeLine } from '@/components/code-block'
import { Cost } from '@/components/cost'
import { ImageThumb } from '@/components/image-lightbox'
import { LinkifiedText } from '@/components/linkified-text'
import { Markdown } from '@/components/markdown'
import { MarkdownReader, ReadButton } from '@/components/markdown-reader'
import { Meter } from '@/components/meter'
import { modelLabel } from '@/components/model-select'
import { runsSessions, StationIcon } from '@/components/station-icon'
import { StatusChip } from '@/components/status/status-chip'
import { Skeleton } from '@/components/ui/skeleton'
import { runQueries } from '@/features/runs/api/run-queries'
import { DiffStatTable } from '@/features/runs/components/diff-stat-table'
import { activityEventId } from '@/features/runs/components/run-outcome-banner'
import {
  activityItems,
  compareCaption,
  groupEvents,
  parseBrowserCall,
  parseToolCall,
  relativize,
  splitErrorMessage,
  splitSystemMessage,
  toolInputJson,
  turnsFromResult,
  type ActivityGroup,
} from '@/features/runs/utils/activity'
import { parseDiffStat } from '@/features/runs/utils/diff-stat'
import { qaFileUrl } from '@/features/runs/utils/qa'
import { readableOutput } from '@/features/runs/utils/readable-output'
import { CI_STATION, REPO_HOOKS_STATION } from '@/features/runs/utils/station-states'
import { detectLanguage } from '@/lib/code-language'
import type { ImageEvent, Run, RunEvent, Station } from '@/lib/contracts'
import {
  durationBetween,
  formatDateTime,
  formatDuration,
  formatTime,
  formatTokens,
} from '@/lib/format'
import { parseDelivery, type Delivery } from '@/lib/links'
import { cn } from '@/lib/utils'

const TOOL_ICON: Record<string, LucideIcon> = {
  Read: FileText,
  Edit: FilePen,
  Write: FilePen,
  MultiEdit: FilePen,
  Bash: Terminal,
  $: Terminal,
  Glob: Search,
  Grep: Search,
  StructuredOutput: Braces,
}

/** Assistant text as markdown; long messages fold behind "Show more". */
function Prose({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [reading, setReading] = useState(false)
  const long = text.length > 700 || text.split('\n').length > 12
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-1">
      <Markdown
        text={text}
        className={cn(
          'w-full',
          long &&
            !expanded &&
            'max-h-56 overflow-clip [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]',
        )}
      />
      {long ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
          <button
            type="button"
            onClick={() => setReading(true)}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open in reader
          </button>
          <MarkdownReader
            open={reading}
            onOpenChange={setReading}
            title="Agent message"
            text={text}
          />
        </div>
      ) : null}
    </div>
  )
}

/** A raw output block: a diff stat as a table, code-shaped text highlighted, the rest plain. */
function Output({ text }: { text: string }) {
  const clean = text.replace(/^\n+/, '').trimEnd()
  const stat = parseDiffStat(clean)
  if (stat !== null) return <DiffStatTable stat={stat} />
  return <CodeBlock code={clean} lang={detectLanguage(clean)} copyLabel="Copy output" />
}

function Row({
  event,
  icon: Icon,
  iconClass,
  children,
}: {
  event: RunEvent
  icon: LucideIcon
  iconClass?: string
  children: ReactNode
}) {
  return (
    <li
      id={activityEventId(event.id)}
      // Off-screen rows skip layout and paint; `auto` remembers each row's real height.
      className="grid scroll-mt-12 grid-cols-[4.25rem_1rem_minmax(0,1fr)] items-start gap-x-2 px-4 py-1 [contain-intrinsic-size:auto_28px] [content-visibility:auto]"
    >
      <time
        dateTime={event.createdAt}
        title={formatDateTime(event.createdAt)}
        className="pt-px font-mono text-[0.6875rem] leading-5 text-muted-foreground/80 tabular-nums"
      >
        {formatTime(event.createdAt)}
      </time>
      <Icon
        aria-hidden="true"
        className={cn('mt-[3px] size-3.5 text-muted-foreground', iconClass)}
      />
      <div className="min-w-0">{children}</div>
    </li>
  )
}

/** The delivery step as a result row: the PR to open, or where the branch went. */
function DeliveryRow({ event, delivery }: { event: RunEvent; delivery: Delivery }) {
  if (delivery.kind === 'pull_request') {
    const { pr } = delivery
    return (
      <Row event={event} icon={GitPullRequest} iconClass="text-status-passed">
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex max-w-full items-center gap-2 rounded-md border border-status-passed/30 bg-status-passed-soft px-2.5 py-1.5 text-[0.8125rem] transition-colors hover:border-status-passed/60"
        >
          <span className="font-medium">
            {pr.number === null ? 'Pull request opened' : `Pull request #${pr.number} opened`}
          </span>
          {pr.repo === null ? null : (
            <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
              {pr.repo}
            </span>
          )}
          <ExternalLink
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
          />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Row>
    )
  }
  return (
    <Row event={event} icon={GitBranch}>
      <p className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5 text-[0.8125rem]">
        <span className="shrink-0 font-medium">
          {delivery.kind === 'pushed' ? 'Pushed' : 'Committed on'}
        </span>
        <span className="truncate font-mono text-xs">{delivery.branch}</span>
        <span className="truncate text-xs text-muted-foreground">
          {delivery.kind === 'pushed'
            ? `to ${delivery.remote ?? 'origin'} · no pull request`
            : 'no remote · no pull request'}
        </span>
      </p>
    </Row>
  )
}

const ROLE_LABEL: Record<ImageEvent['role'], string> = {
  base: 'Base',
  pr: 'PR',
  diff: 'Diff',
  agent: 'Browser',
  preview: 'Preview',
}

/**
 * Screenshots inline: fixed-size thumbnails (no layout shift as they load),
 * Base · PR · Diff side by side when they belong to one check.
 */
function ImageRow({
  event,
  images,
  runId,
}: {
  event: RunEvent
  images: ImageEvent[]
  runId: string
}) {
  const compare = images.length > 1
  const first = images[0]
  const caption = compare ? compareCaption(images) : (first?.caption ?? '')
  // One gallery per row: a Base/PR/Diff row opens on the clicked image and pages through all three.
  const gallery = images.map((image) => ({
    src: qaFileUrl(runId, image.file),
    label: compare || image.role !== 'agent' ? ROLE_LABEL[image.role] : undefined,
    caption: compare ? caption : image.caption,
    detail: image.file,
  }))
  return (
    <Row event={event} icon={ImageIcon}>
      <figure className="flex flex-col gap-1 py-0.5">
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <ImageThumb key={`${image.role}-${image.file}`} images={gallery} index={index} />
          ))}
        </div>
        {caption === '' ? null : (
          <figcaption className="text-xs leading-5 text-muted-foreground">{caption}</figcaption>
        )}
      </figure>
    </Row>
  )
}

const SHELL_TOOLS = new Set(['$', 'Bash'])

/** One condensed line per tool call; a multi-field JSON input expands below it. */
function ToolCallRow({
  event,
  worktreePath,
}: {
  event: RunEvent
  worktreePath: string | null
}) {
  const [open, setOpen] = useState(false)
  const call = parseToolCall(event.message, worktreePath)
  const input = toolInputJson(relativize(event.message, worktreePath))
  const line = (
    <>
      <span className="max-w-56 shrink-0 truncate text-left text-foreground" title={call.tool}>
        {call.tool === '$' ? 'Shell' : call.tool}
      </span>
      {SHELL_TOOLS.has(call.tool) ? (
        <CodeLine code={call.summary} lang="shellscript" className="min-w-0 truncate" />
      ) : (
        <span className="min-w-0 truncate text-left text-muted-foreground" title={call.summary}>
          {call.summary}
        </span>
      )}
    </>
  )
  return (
    <Row event={event} icon={TOOL_ICON[call.tool] ?? Wrench}>
      {input === null ? (
        <p className="flex min-w-0 items-baseline gap-2 font-mono text-[0.75rem] leading-5">
          {line}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="group/tool flex max-w-full min-w-0 items-baseline gap-2 rounded-sm font-mono text-[0.75rem] leading-5"
          >
            {line}
            <ChevronRight
              aria-hidden="true"
              className={cn(
                'size-3 shrink-0 self-center text-muted-foreground/60 transition-transform group-hover/tool:text-foreground',
                open && 'rotate-90',
              )}
            />
            <span className="sr-only">{open ? 'Hide input' : 'Show input'}</span>
          </button>
          {open ? (
            <CodeBlock code={input} lang="json" className="max-h-64" copyLabel="Copy input" />
          ) : null}
        </div>
      )}
    </Row>
  )
}

/**
 * Memoized: a live run appends events and the feed re-renders, but query
 * results keep unchanged events by reference, so old rows skip re-parsing.
 */
const EventRow = memo(function EventRow({
  event,
  worktreePath,
}: {
  event: RunEvent
  worktreePath: string | null
}) {
  switch (event.type) {
    case 'text':
      return (
        <Row event={event} icon={Info} iconClass="opacity-0">
          <Prose text={relativize(event.message, worktreePath)} />
        </Row>
      )
    case 'tool_use': {
      const browser = parseBrowserCall(event.message)
      if (browser !== null) {
        return (
          <Row event={event} icon={Globe}>
            <p className="flex min-w-0 items-baseline gap-2 font-mono text-[0.75rem] leading-5">
              <span className="max-w-56 shrink-0 truncate text-foreground">Browser</span>
              <span className="shrink-0 text-foreground">{browser.action}</span>
              <span className="truncate text-muted-foreground" title={browser.target}>
                {browser.target}
              </span>
            </p>
          </Row>
        )
      }
      return <ToolCallRow event={event} worktreePath={worktreePath} />
    }
    case 'tool_result':
      return (
        <Row event={event} icon={ChevronRight}>
          <Output text={relativize(event.message, worktreePath)} />
        </Row>
      )
    case 'result': {
      const ok = event.message.startsWith('success')
      return (
        <Row
          event={event}
          icon={ok ? CircleCheck : CircleX}
          iconClass={ok ? 'text-status-passed' : 'text-status-failed'}
        >
          <p className="font-mono text-[0.75rem] leading-5 text-muted-foreground">
            {event.message}
          </p>
        </Row>
      )
    }
    case 'error': {
      const { head, log } = splitErrorMessage(relativize(event.message, worktreePath))
      return (
        <Row event={event} icon={CircleX} iconClass="text-status-failed">
          <div className="flex flex-col gap-1">
            <p className="rounded-md bg-status-failed-soft px-2 py-1 text-[0.8125rem] whitespace-pre-wrap text-status-failed">
              {head}
            </p>
            {log === null ? null : <Output text={log} />}
          </div>
        </Row>
      )
    }
    case 'image':
      // Only reached when the payload didn't parse; valid images render as ImageRow.
      return (
        <Row event={event} icon={ImageIcon}>
          <p className="text-xs leading-5 text-muted-foreground">Screenshot unavailable</p>
        </Row>
      )
    case 'system': {
      const delivery = parseDelivery(event.message)
      if (delivery !== null) return <DeliveryRow event={event} delivery={delivery} />
      const {
        head: first,
        notes,
        output,
      } = splitSystemMessage(relativize(event.message, worktreePath))
      // The QA station's closing summary on a pass ("QA passed · 5 pass · …").
      const qaPassed = first.startsWith('QA passed')
      return (
        <Row
          event={event}
          icon={qaPassed ? CircleCheck : Info}
          iconClass={qaPassed ? 'text-status-passed' : undefined}
        >
          <p
            className={cn(
              'text-xs leading-5',
              qaPassed ? 'text-foreground/90' : 'text-muted-foreground',
            )}
          >
            <LinkifiedText text={first.replace(/^Session \S+ · /, 'Session · ')} />
          </p>
          {notes.map((note, index) => (
            <p
              key={index}
              className="max-w-[72ch] text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground"
            >
              <LinkifiedText text={note} />
            </p>
          ))}
          {output === null ? null : <Output text={output} />}
        </Row>
      )
    }
  }
  return null
})

function GroupHeader({
  group,
  station,
  expanded,
  onToggle,
}: {
  group: ActivityGroup
  station: Station | undefined
  expanded: boolean
  onToggle: () => void
}) {
  const sr = group.stationRun
  const resultEvent = group.events.findLast((event) => event.type === 'result')
  const turns =
    sr === null
      ? null
      : sr.numTurns > 0
        ? sr.numTurns
        : turnsFromResult(resultEvent?.message ?? '')
  const hasContext = sr !== null && sr.contextWindow !== null && sr.contextTokens > 0
  const reading = sr === null ? null : readableOutput(station, sr)
  const name = sr === null ? 'Workspace' : (station?.name ?? sr.stationKey)
  return (
    <div className="sticky top-0 z-[5] flex h-10 items-center gap-2 border-y bg-card/95 px-4 backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-w-0 items-center gap-2 rounded-sm text-left"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'size-3.5 text-muted-foreground transition-transform',
            expanded && 'rotate-90',
          )}
        />
        {station === undefined ? null : (
          <StationIcon
            kind={station.kind}
            stationKey={station.key}
            className="text-muted-foreground"
          />
        )}
        <span className="truncate text-[0.8125rem] font-semibold">{name}</span>
        {sr !== null && sr.attempt > 1 ? (
          <span className="text-xs text-muted-foreground">
            attempt {sr.attempt}
            {station?.kind === 'agent' ? ' · resumed session' : null}
          </span>
        ) : null}
      </button>
      {sr === null ? null : (
        <StatusChip
          status={sr.status}
          label={sr.status === 'awaiting_approval' ? 'Waiting' : undefined}
          variant="plain"
        />
      )}
      {reading === null ? null : (
        <ReadButton
          title={name}
          description={sr !== null && sr.attempt > 1 ? `Attempt ${sr.attempt}` : undefined}
          text={reading}
          className="text-muted-foreground"
        />
      )}
      {sr === null ? null : (
        <div className="ml-auto flex items-center gap-3 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {sr.model === null ? null : <span>{modelLabel(sr.model)}</span>}
          {turns === null || turns === 0 ? null : <span>{turns} turns</span>}
          <span>{formatDuration(durationBetween(sr.startedAt, sr.finishedAt))}</span>
          {station !== undefined && runsSessions(station.kind) ? (
            <Cost usd={sr.costUsd} authSource={sr.authSource} />
          ) : null}
          {hasContext && sr.contextWindow !== null ? (
            <span className="flex items-center gap-1.5">
              <Meter
                value={sr.contextTokens}
                max={sr.contextWindow}
                warnAt={80}
                failAt={95}
                label={`${station?.name ?? sr.stationKey} context`}
                className="w-12"
              />
              {formatTokens(sr.contextTokens)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}

const REVIEWER_PREFIX = /^Reviewer:\s*/

/** The reviewer's comment on a gate that sent work back, if any. */
function changeRequest(group: ActivityGroup): string | null {
  const sr = group.stationRun
  if (sr?.status !== 'changes_requested') return null
  const logged = group.events.findLast(
    (event) => event.type === 'system' && REVIEWER_PREFIX.test(event.message),
  )
  const text = sr.output ?? logged?.message ?? null
  return text === null ? null : text.replace(REVIEWER_PREFIX, '')
}

function ChangeRequestQuote({ comment }: { comment: string }) {
  return (
    <li className="px-4 py-1 pl-[6.75rem]">
      <figure className="flex flex-col gap-1">
        <figcaption className="flex items-center gap-1.5 text-xs text-status-waiting">
          <MessageSquareReply aria-hidden="true" className="size-3.5" />
          Changes requested
        </figcaption>
        <blockquote className="max-w-[72ch] border-l-2 border-status-waiting/60 bg-status-waiting-soft/60 py-1.5 pr-2 pl-3 text-[0.8125rem] leading-relaxed whitespace-pre-wrap text-foreground/90">
          {comment}
        </blockquote>
      </figure>
    </li>
  )
}

/**
 * The run as it happened, grouped by station: tool calls condensed to one
 * line, assistant text as prose, outputs collapsed into scroll boxes.
 * SSE `run_event` invalidates the query; this only renders and follows.
 */
export function ActivityFeed({
  run,
  stations,
  stationKey,
}: {
  run: Run
  stations: Station[]
  /** Show only this station's groups. */
  stationKey: string | undefined
}) {
  const { data: events, error, isPending } = useQuery(runQueries.events(run.id))
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  // The repo-hooks preflight isn't a line station but logs under its own station run.
  const stationByKey = new Map(
    [...stations, REPO_HOOKS_STATION, CI_STATION].map((station) => [station.key, station]),
  )
  const live = run.status === 'running'
  const count = events?.length ?? 0

  // Follows new rows only while the reader is at the bottom; a live run opens there.
  const { attach, unseen, jumpToBottom } = useStickToBottom(count, { startAtBottom: live })

  if (isPending) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className={cn('h-5', index % 3 === 0 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    )
  }
  if (error !== null && events === undefined) {
    return (
      <p className="p-4 text-sm text-status-failed">The log is unavailable: {error.message}</p>
    )
  }

  const groups = groupEvents(events ?? [], run.stations).filter(
    (group) => stationKey === undefined || group.stationRun?.stationKey === stationKey,
  )

  if (groups.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {stationKey === undefined
          ? 'No activity yet.'
          : 'This station has no activity in this run.'}
      </p>
    )
  }

  return (
    <>
      <div
        ref={attach}
        role="log"
        aria-live={live ? 'polite' : 'off'}
        aria-label="Run activity"
        className="pb-4"
      >
        {groups.map((group, index) => {
          const id = group.stationRun?.id ?? `run-${index}`
          const expanded = !collapsed.has(id)
          const request = changeRequest(group)
          // The quote replaces the logged "Reviewer: …" line.
          const rows =
            request === null
              ? group.events
              : group.events.filter(
                  (event) => !(event.type === 'system' && REVIEWER_PREFIX.test(event.message)),
                )
          return (
            <section key={`${id}-${index}`}>
              <GroupHeader
                group={group}
                station={
                  group.stationRun === null
                    ? undefined
                    : stationByKey.get(group.stationRun.stationKey)
                }
                expanded={expanded}
                onToggle={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
              {expanded ? (
                <ul className="flex flex-col py-1.5">
                  {rows.length === 0 && request === null ? (
                    <li className="px-4 py-1 pl-[6.75rem] text-xs text-muted-foreground">
                      {group.stationRun?.status === 'awaiting_approval'
                        ? 'Waiting for a decision.'
                        : 'No events yet.'}
                    </li>
                  ) : null}
                  {activityItems(rows).map((item) =>
                    item.type === 'images' ? (
                      <ImageRow
                        key={item.event.id}
                        event={item.event}
                        images={item.images}
                        runId={run.id}
                      />
                    ) : (
                      <EventRow
                        key={item.event.id}
                        event={item.event}
                        worktreePath={run.worktreePath}
                      />
                    ),
                  )}
                  {request === null ? null : <ChangeRequestQuote comment={request} />}
                  {group.stationRun?.error == null ? null : (
                    <li className="px-4 py-1 pl-[6.75rem]">
                      <p className="rounded-md bg-status-failed-soft px-2 py-1 text-[0.8125rem] text-status-failed">
                        {group.stationRun.error}
                      </p>
                    </li>
                  )}
                </ul>
              ) : null}
            </section>
          )
        })}
      </div>
      {unseen === 0 ? null : (
        // Sticky inside the panel's scroll body, outside the live region.
        <div className="pointer-events-none sticky bottom-3 flex justify-center">
          <button
            type="button"
            onClick={jumpToBottom}
            className="pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-full border bg-popover px-3 text-xs font-medium shadow-md transition-colors hover:bg-accent"
          >
            New activity
            <span className="font-mono text-muted-foreground tabular-nums">{unseen}</span>
            <ArrowDown aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      )}
    </>
  )
}
