import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GitBranch, GitCommitHorizontal, SquareArrowOutUpRight, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { STATUS_LABEL, TONE, TONE_BG } from '@/components/status/status'
import { StatusChip } from '@/components/status/status-chip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { CiBadge } from '@/components/ci-badge'
import { PrLink } from '@/components/pr-link'
import {
  canDeleteWorkOrder,
  DeleteWorkOrderDialog,
} from '@/features/work-orders/components/delete-work-order-dialog'
import { QueuedChip, QueueMenuItems } from '@/features/work-orders/components/queue-actions'
import { stoppedLabel } from '@/features/work-orders/utils/card-outcome'
import { pipelineFor } from '@/features/work-orders/utils/pipeline'
import type { Station, WorkOrder } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** One 4px segment per station, colored by that station's derived status. */
function PipelineStrip({ workOrder, stations }: { workOrder: WorkOrder; stations: Station[] }) {
  if (stations.length === 0) return null
  const statuses = pipelineFor(workOrder, stations)
  const summary = stations
    .map((station, index) => {
      const status = statuses[index] ?? 'queued'
      return `${station.name}: ${STATUS_LABEL[status]}`
    })
    .join(', ')
  return (
    <div className="flex w-full gap-0.5">
      <span className="sr-only">Pipeline — {summary}</span>
      {statuses.map((status, index) => (
        <span
          key={stations[index]?.key ?? index}
          aria-hidden="true"
          className={cn(
            'h-1 flex-1 rounded-full',
            status === 'queued' ? 'bg-muted' : TONE_BG[TONE[status]],
            status === 'running' && 'animate-pulse-soft',
          )}
        />
      ))}
    </div>
  )
}

/**
 * The title button is stretched over the whole card (`after:inset-0`), so the
 * card stays one click target while the PR link stays a real, separate link
 * (a link can't live inside a button).
 */
function CardBody({
  workOrder,
  stations,
  onOpen,
}: {
  workOrder: WorkOrder
  stations: Station[]
  onOpen: (id: string) => void
}) {
  const needsYou = workOrder.status === 'awaiting_approval'
  const stopped = stoppedLabel(workOrder, stations)
  const committedLocally = workOrder.status === 'done' && workOrder.prUrl == null
  return (
    <>
      {needsYou || stopped !== null ? (
        // Needs you (violet) or stopped (status tone): the card isn't moving on its own.
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-y-0 left-0 w-[3px] rounded-l-md',
            needsYou ? 'bg-status-waiting' : TONE_BG[TONE[workOrder.status]],
          )}
        />
      ) : null}
      <button
        type="button"
        data-wo-card={workOrder.id}
        onClick={() => onOpen(workOrder.id)}
        className="w-full text-left text-[0.8125rem] leading-5 font-medium outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
      >
        {/* Clamp an inner span: Chromium won't lay a <button> out as -webkit-box,
            and a whole-pixel line-height keeps descenders inside the clip. */}
        <span className="line-clamp-2 break-words">{workOrder.title}</span>
      </button>
      {workOrder.status === 'backlog' ? null : workOrder.status === 'queued' ? (
        <QueuedChip queueMode={workOrder.queueMode} />
      ) : (
        <StatusChip status={workOrder.status} label={stopped ?? undefined} />
      )}
      <PipelineStrip workOrder={workOrder} stations={stations} />
      {workOrder.branch === null && workOrder.prUrl == null && !committedLocally ? null : (
        <span className="flex w-full min-w-0 items-center gap-2 font-mono text-[0.6875rem] text-muted-foreground">
          {workOrder.branch === null ? null : (
            <span className="flex min-w-0 flex-1 items-center gap-1" title={workOrder.branch}>
              <GitBranch aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{workOrder.branch.replace(/^zastava\//, '')}</span>
            </span>
          )}
          {workOrder.prUrl == null || workOrder.ci == null ? null : (
            <CiBadge
              ci={workOrder.ci}
              prUrl={workOrder.prUrl}
              className="relative z-10 -my-1 ml-auto font-sans"
            />
          )}
          {workOrder.prUrl == null ? null : (
            <PrLink
              url={workOrder.prUrl}
              className={cn('relative z-10 -my-1', workOrder.ci == null && 'ml-auto')}
            />
          )}
          {committedLocally ? (
            <span className="ml-auto flex shrink-0 items-center gap-1 font-sans">
              <GitCommitHorizontal aria-hidden="true" className="size-3.5 text-status-passed" />
              Committed locally
            </span>
          ) : null}
        </span>
      )}
    </>
  )
}

/**
 * `shrink-0`: cards sit in a scrolling flex column. Without it, a long column
 * squeezes each card down to `min-h-18` and its footer spills over the next card.
 */
const CARD_CLASS =
  'group relative flex min-h-18 w-full shrink-0 flex-col items-start gap-2 rounded-md border bg-card px-3 py-2.5 text-left transition-colors duration-150 hover:border-foreground/15 hover:bg-accent/60'

/** Right-click (or the context-menu key) on a card: open, start, queue, delete. */
function CardMenu({
  workOrder,
  onOpen,
  children,
}: {
  workOrder: WorkOrder
  onOpen: (id: string) => void
  children: React.ReactNode
}) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={() => onOpen(workOrder.id)}>
            <SquareArrowOutUpRight aria-hidden="true" />
            Open
          </ContextMenuItem>
          <QueueMenuItems workOrder={workOrder} />
          {canDeleteWorkOrder(workOrder.status) ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" />
                Delete…
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <DeleteWorkOrderDialog
        projectId={workOrder.projectId}
        workOrder={workOrder}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  )
}

export function WorkOrderCard({
  workOrder,
  stations,
  onOpen,
}: {
  workOrder: WorkOrder
  stations: Station[]
  onOpen: (id: string) => void
}) {
  return (
    <CardMenu workOrder={workOrder} onOpen={onOpen}>
      <div className={CARD_CLASS}>
        <CardBody workOrder={workOrder} stations={stations} onOpen={onOpen} />
      </div>
    </CardMenu>
  )
}

/** Backlog card: draggable to reorder. A click without movement still opens it. */
export function SortableWorkOrderCard({
  workOrder,
  stations,
  onOpen,
}: {
  workOrder: WorkOrder
  stations: Station[]
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workOrder.id,
  })
  return (
    <CardMenu workOrder={workOrder} onOpen={onOpen}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(CARD_CLASS, 'cursor-grab', isDragging && 'z-10 opacity-80 shadow-lg')}
        {...attributes}
        {...listeners}
      >
        <CardBody workOrder={workOrder} stations={stations} onOpen={onOpen} />
      </div>
    </CardMenu>
  )
}
