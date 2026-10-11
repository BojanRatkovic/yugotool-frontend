import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useWorkOrders } from '@/features/work-orders/api/use-work-order'
import { NewWorkOrderForm } from '@/features/work-orders/components/new-work-order-form'
import { positionBetween } from '@/features/work-orders/utils/board-columns'

/** `C` / "New work order": lands at the bottom of the backlog. */
export function NewWorkOrderDialog({
  projectId,
  open,
  onOpenChange,
  repos,
  headerAction,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A hub project's repos (spec 0014). */
  repos?: string[]
  /** Beside the title, e.g. "Import from Productive" (composed by the route). */
  headerAction?: ReactNode
}) {
  const workOrders = useWorkOrders(projectId)
  const last = workOrders
    .filter((workOrder) => workOrder.status === 'backlog' || workOrder.status === 'queued')
    .reduce<number | undefined>(
      (max, workOrder) =>
        max === undefined ? workOrder.position : Math.max(max, workOrder.position),
      undefined,
    )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="flex-row items-start gap-3 pr-8">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <DialogTitle>New work order</DialogTitle>
            <DialogDescription>It waits in the backlog until you start it.</DialogDescription>
          </div>
          {headerAction}
        </DialogHeader>
        <NewWorkOrderForm
          projectId={projectId}
          position={positionBetween(last, undefined)}
          onDone={() => onOpenChange(false)}
          className="border-0 bg-transparent p-0"
          repos={repos}
        />
      </DialogContent>
    </Dialog>
  )
}
