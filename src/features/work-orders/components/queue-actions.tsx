import { ChevronDown, ListEnd, ListX, Moon, Play, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { StatusChip } from '@/components/status/status-chip'
import { Button } from '@/components/ui/button'
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  useDequeueWorkOrder,
  useEnqueueWorkOrder,
  useStartWorkOrder,
} from '@/features/work-orders/api/work-order-mutations'
import { errorMessage } from '@/lib/api-client'
import type { QueueMode, WorkOrder } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** Orders whose last run ended without delivering; they can go down the line again. */
const RERUNNABLE: ReadonlySet<WorkOrder['status']> = new Set([
  'failed',
  'rejected',
  'cancelled',
])

function canRunAgain(status: WorkOrder['status']): boolean {
  return RERUNNABLE.has(status)
}

const QUEUED_TOAST: Record<QueueMode, string> = {
  asap: 'Queued — it runs at the next free slot.',
  night: 'Queued for the night shift.',
}

/** Start / queue / dequeue for one work order, with toasts. Shared by the header and the card menu. */
function useQueueActions(workOrder: Pick<WorkOrder, 'id'>) {
  const start = useStartWorkOrder()
  const enqueue = useEnqueueWorkOrder()
  const dequeue = useDequeueWorkOrder()
  const workOrderId = workOrder.id
  return {
    isPending: start.isPending || enqueue.isPending || dequeue.isPending,
    start: () =>
      start.mutate(
        { workOrderId },
        {
          onSuccess: () => toast.success('Started — the work order is on the line.'),
          onError: (error) => toast.error(`Couldn't start: ${errorMessage(error)}`),
        },
      ),
    runAgain: () =>
      start.mutate(
        { workOrderId },
        {
          onSuccess: () => toast.success('Started a new run — the work order is on the line.'),
          onError: (error) => toast.error(`Couldn't run again: ${errorMessage(error)}`),
        },
      ),
    enqueue: (mode: QueueMode) =>
      enqueue.mutate(
        { workOrderId, mode },
        {
          onSuccess: () => toast.success(QUEUED_TOAST[mode]),
          onError: (error) => toast.error(`Couldn't queue: ${errorMessage(error)}`),
        },
      ),
    dequeue: () =>
      dequeue.mutate(
        { workOrderId },
        {
          onSuccess: () => toast.success('Removed from the queue — back in the backlog.'),
          onError: (error) =>
            toast.error(`Couldn't remove from the queue: ${errorMessage(error)}`),
        },
      ),
  }
}

/** "Queued" chip; a moon marks orders that wait for the night shift. */
export function QueuedChip({
  queueMode,
  className,
}: {
  queueMode: QueueMode | null
  className?: string
}) {
  if (queueMode !== 'night') return <StatusChip status="queued" className={className} />
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1', className)}>
          <StatusChip status="queued" />
          <Moon aria-hidden="true" className="size-3 text-status-queued" />
          <span className="sr-only">for the night shift</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Runs in the night shift</TooltipContent>
    </Tooltip>
  )
}

/** "Run again" for an order whose last run failed, was rejected or cancelled. */
export function RunAgainButton({
  workOrder,
  variant = 'default',
  size = 'sm',
}: {
  workOrder: WorkOrder
  variant?: 'default' | 'outline'
  size?: 'sm' | 'xs'
}) {
  const actions = useQueueActions(workOrder)
  if (!canRunAgain(workOrder.status)) return null
  return (
    <Button
      variant={variant}
      size={size}
      disabled={actions.isPending}
      onClick={actions.runAgain}
      className="shrink-0"
    >
      <RotateCcw aria-hidden="true" />
      Run again
    </Button>
  )
}

/**
 * Header actions for an order that isn't on the line: Start now (Run again
 * after a failed, rejected or cancelled run) · Queue ▾ — or Remove from queue.
 */
export function QueueButtons({ workOrder }: { workOrder: WorkOrder }) {
  const actions = useQueueActions(workOrder)

  if (workOrder.status === 'queued') {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={actions.isPending}
        onClick={actions.dequeue}
      >
        <ListX aria-hidden="true" />
        Remove from queue
      </Button>
    )
  }
  const again = canRunAgain(workOrder.status)
  if (workOrder.status !== 'backlog' && !again) return null

  return (
    <>
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={actions.isPending}
          onClick={() => actions.enqueue('asap')}
          className="rounded-r-none border-r-0"
        >
          <ListEnd aria-hidden="true" />
          Queue
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={actions.isPending}
              aria-label="More queue options"
              className="rounded-l-none"
            >
              <ChevronDown aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => actions.enqueue('asap')}>
              <ListEnd aria-hidden="true" />
              Run next
              <span className="ml-auto text-xs text-muted-foreground">asap</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.enqueue('night')}>
              <Moon aria-hidden="true" />
              Run tonight
              <span className="ml-auto text-xs text-muted-foreground">night shift</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {again ? (
        <RunAgainButton workOrder={workOrder} />
      ) : (
        <Button size="sm" disabled={actions.isPending} onClick={actions.start}>
          <Play aria-hidden="true" />
          Start now
        </Button>
      )}
    </>
  )
}

/** Card context-menu items; render inside a `ContextMenuContent`. */
export function QueueMenuItems({ workOrder }: { workOrder: WorkOrder }) {
  const actions = useQueueActions(workOrder)
  if (workOrder.status === 'queued') {
    return (
      <ContextMenuItem onSelect={actions.dequeue}>
        <ListX aria-hidden="true" />
        Remove from queue
      </ContextMenuItem>
    )
  }
  const again = canRunAgain(workOrder.status)
  if (workOrder.status !== 'backlog' && !again) return null
  return (
    <>
      {again ? (
        <ContextMenuItem onSelect={actions.runAgain}>
          <RotateCcw aria-hidden="true" />
          Run again
        </ContextMenuItem>
      ) : (
        <ContextMenuItem onSelect={actions.start}>
          <Play aria-hidden="true" />
          Start now
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => actions.enqueue('asap')}>
        <ListEnd aria-hidden="true" />
        Run next
        <span className="ml-auto text-xs text-muted-foreground">asap</span>
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => actions.enqueue('night')}>
        <Moon aria-hidden="true" />
        Run tonight
        <span className="ml-auto text-xs text-muted-foreground">night shift</span>
      </ContextMenuItem>
    </>
  )
}
