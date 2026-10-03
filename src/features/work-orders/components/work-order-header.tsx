import { Code2, Square } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { StatusChip } from '@/components/status/status-chip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  useCancelWorkOrder,
  useOpenInEditor,
} from '@/features/work-orders/api/work-order-mutations'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import { PrLink } from '@/components/pr-link'
import { QueueButtons, QueuedChip } from '@/features/work-orders/components/queue-actions'
import { errorMessage } from '@/lib/api-client'
import type { WorkOrder } from '@/lib/contracts'

function TitleField({ projectId, workOrder }: { projectId: string; workOrder: WorkOrder }) {
  const [draft, setDraft] = useState(workOrder.title)

  function save() {
    const title = draft.trim()
    if (title === '' || title === workOrder.title) {
      setDraft(workOrder.title)
      return
    }
    const tx = workOrdersCollection(projectId).update(workOrder.id, (row) => {
      row.title = title
    })
    tx.isPersisted.promise.catch((error: unknown) => {
      setDraft(workOrder.title)
      toast.error(`Couldn't rename: ${errorMessage(error)}`)
    })
  }

  return (
    <input
      aria-label="Title"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          event.stopPropagation()
          setDraft(workOrder.title)
          event.currentTarget.blur()
        }
      }}
      className="h-8 min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-1.5 text-base font-semibold outline-none hover:border-border focus-visible:border-input focus-visible:bg-background focus-visible:outline-none"
    />
  )
}

/** Panel header: status, editable title, the commands that move the order, and slot controls. */
export function WorkOrderHeader({
  projectId,
  workOrder,
  controls,
}: {
  projectId: string
  workOrder: WorkOrder
  /** Expand / close, owned by the route. */
  controls: ReactNode
}) {
  const cancel = useCancelWorkOrder()
  const openEditor = useOpenInEditor()
  const isActive = workOrder.status === 'running' || workOrder.status === 'awaiting_approval'

  return (
    <header className="flex flex-col gap-1 border-b px-4 pt-3 pb-2">
      <div className="flex items-center gap-2">
        {workOrder.status === 'queued' ? (
          <QueuedChip queueMode={workOrder.queueMode} />
        ) : (
          <StatusChip status={workOrder.status} />
        )}
        {/* Remount on server changes so the field shows the saved title. */}
        <TitleField key={workOrder.title} projectId={projectId} workOrder={workOrder} />
        <div className="flex shrink-0 items-center gap-1.5">
          {workOrder.prUrl == null ? null : (
            <PrLink url={workOrder.prUrl} variant="button" className="mr-1" />
          )}
          {workOrder.currentRunId === null ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={openEditor.isPending}
              onClick={() =>
                openEditor.mutate(
                  { workOrderId: workOrder.id },
                  {
                    onSuccess: () => toast.success('Opened the worktree in VS Code.'),
                    onError: (error) =>
                      toast.error(`Couldn't open the editor: ${errorMessage(error)}`),
                  },
                )
              }
            >
              <Code2 aria-hidden="true" />
              Open in editor
            </Button>
          )}
          {isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancel.isPending}
                  className="text-status-failed hover:text-status-failed"
                >
                  <Square aria-hidden="true" />
                  Cancel run
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this run?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The agent stops now. Work so far stays on{' '}
                    {workOrder.branch === null ? (
                      'its branch'
                    ) : (
                      <span className="font-mono text-foreground">{workOrder.branch}</span>
                    )}
                    ; you can run it again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      cancel.mutate(
                        { workOrderId: workOrder.id },
                        {
                          onSuccess: () => toast.success('Cancelled the run.'),
                          onError: (error) =>
                            toast.error(`Couldn't cancel: ${errorMessage(error)}`),
                        },
                      )
                    }
                  >
                    Cancel run
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <QueueButtons workOrder={workOrder} />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          {controls}
        </div>
      </div>
      {workOrder.description === '' ? null : (
        <p className="line-clamp-2 max-w-[80ch] pl-[0.375rem] text-[0.8125rem] text-muted-foreground">
          {workOrder.description}
        </p>
      )}
    </header>
  )
}
