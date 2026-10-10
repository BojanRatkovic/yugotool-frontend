import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import { errorMessage } from '@/lib/api-client'
import type { WorkOrder } from '@/lib/contracts'

/** The server refuses these (409 `work_order_active`): cancel the run first. */
export function canDeleteWorkOrder(status: WorkOrder['status']): boolean {
  return status !== 'running' && status !== 'awaiting_approval'
}

/**
 * Confirms, then removes the order from the board right away; a failed
 * delete puts it back with a toast. Controlled, so a menu item can open it.
 */
export function DeleteWorkOrderDialog({
  projectId,
  workOrder,
  open,
  onOpenChange,
  onDeleted,
}: {
  projectId: string
  workOrder: WorkOrder
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs once the order leaves the board (e.g. close its panel). */
  onDeleted?: () => void
}) {
  function confirm() {
    const tx = workOrdersCollection(projectId).delete(workOrder.id)
    onDeleted?.()
    tx.isPersisted.promise.then(
      () => toast.success(`Deleted “${workOrder.title}”.`),
      (error: unknown) => toast.error(`Couldn't delete: ${errorMessage(error)}`),
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this work order?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="text-foreground">{workOrder.title}</span>
            {workOrder.currentRunId === null
              ? ' goes for good.'
              : ' goes for good, with its run history, worktree and artifacts.'}
            {workOrder.branch === null ? null : (
              <>
                {' '}
                The branch <span className="font-mono text-foreground">
                  {workOrder.branch}
                </span>{' '}
                stays in the repo.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
