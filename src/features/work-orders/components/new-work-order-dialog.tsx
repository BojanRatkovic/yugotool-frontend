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
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
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
        <DialogHeader>
          <DialogTitle>New work order</DialogTitle>
          <DialogDescription>It waits in the backlog until you start it.</DialogDescription>
        </DialogHeader>
        <NewWorkOrderForm
          projectId={projectId}
          position={positionBetween(last, undefined)}
          onDone={() => onOpenChange(false)}
          className="border-0 bg-transparent p-0"
        />
      </DialogContent>
    </Dialog>
  )
}
