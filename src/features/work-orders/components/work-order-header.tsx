import { Code2, Ellipsis, Pencil, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useCancelWorkOrder,
  useOpenInEditor,
} from '@/features/work-orders/api/work-order-mutations'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import {
  canDeleteWorkOrder,
  DeleteWorkOrderDialog,
} from '@/features/work-orders/components/delete-work-order-dialog'
import { PrLink } from '@/components/pr-link'
import { SourceLink } from '@/components/source-link'
import { QueueButtons, QueuedChip } from '@/features/work-orders/components/queue-actions'
import { errorMessage } from '@/lib/api-client'
import type { WorkOrder } from '@/lib/contracts'
import { IS_MAC } from '@/lib/shortcuts'

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

const DESCRIPTION_MAX = 20_000

/** The description: two lines at rest, a textarea on click. `⌘↵` saves, Esc cancels. */
function DescriptionField({
  projectId,
  workOrder,
}: {
  projectId: string
  workOrder: WorkOrder
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const editing = draft !== null
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  function save(text: string) {
    setDraft(null)
    if (text === workOrder.description) return
    const tx = workOrdersCollection(projectId).update(workOrder.id, (row) => {
      row.description = text
    })
    tx.isPersisted.promise.catch((error: unknown) => {
      setDraft(text)
      toast.error(`Couldn't save the description: ${errorMessage(error)}`)
    })
  }

  if (draft === null) {
    const empty = workOrder.description.trim() === ''
    return (
      <button
        type="button"
        onClick={() => setDraft(workOrder.description)}
        aria-label={empty ? 'Add a description' : 'Edit description'}
        className="group/desc flex max-w-[80ch] items-start gap-1.5 rounded-md px-1.5 py-0.5 text-left text-[0.8125rem] text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className={empty ? 'italic opacity-70' : 'line-clamp-2 whitespace-pre-line'}>
          {empty ? 'Add a description…' : workOrder.description}
        </span>
        <Pencil
          aria-hidden="true"
          className="mt-1 size-3 shrink-0 opacity-0 transition-opacity group-hover/desc:opacity-100 group-focus-visible/desc:opacity-100"
        />
      </button>
    )
  }

  const tooLong = draft.length > DESCRIPTION_MAX
  return (
    <div className="flex max-w-[80ch] flex-col gap-1.5 px-1.5 pb-1">
      <Textarea
        ref={textareaRef}
        aria-label="Description"
        value={draft}
        rows={Math.min(14, Math.max(4, draft.split('\n').length + 1))}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            setDraft(null)
          }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !tooLong) {
            // The panel's ⌘↵ approves a gate; this one is the field's.
            event.preventDefault()
            event.stopPropagation()
            save(draft)
          }
        }}
        aria-invalid={tooLong ? true : undefined}
        className="min-h-20 resize-y bg-background text-[0.8125rem] leading-relaxed"
        placeholder="What should the line build? Markdown is fine."
      />
      <div className="flex items-center gap-2">
        <Button size="xs" disabled={tooLong} onClick={() => save(draft)}>
          Save
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
          Cancel
        </Button>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {tooLong
            ? `${draft.length.toLocaleString()} / ${DESCRIPTION_MAX.toLocaleString()} characters`
            : `${IS_MAC ? '⌘' : 'Ctrl'}↵ saves · Esc cancels`}
        </span>
      </div>
    </div>
  )
}

/** Rarely-used, destructive actions live behind ⋯, away from the run buttons. */
function MoreMenu({
  projectId,
  workOrder,
  onDeleted,
}: {
  projectId: string
  workOrder: WorkOrder
  onDeleted: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const deletable = canDeleteWorkOrder(workOrder.status)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            variant="destructive"
            disabled={!deletable}
            onSelect={() => setConfirming(true)}
          >
            <Trash2 aria-hidden="true" />
            Delete work order…
          </DropdownMenuItem>
          {deletable ? null : (
            <p className="px-1.5 pt-0.5 pb-1 text-xs text-muted-foreground">
              Cancel the run before deleting.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteWorkOrderDialog
        projectId={projectId}
        workOrder={workOrder}
        open={confirming}
        onOpenChange={setConfirming}
        onDeleted={onDeleted}
      />
    </>
  )
}

/** Panel header: status, editable title, the commands that move the order, and slot controls. */
export function WorkOrderHeader({
  projectId,
  workOrder,
  controls,
  onDeleted,
}: {
  projectId: string
  workOrder: WorkOrder
  /** Expand / close, owned by the route. */
  controls: ReactNode
  /** The order is gone; the route closes the panel. */
  onDeleted: () => void
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
          {workOrder.source == null ? null : (
            <SourceLink source={workOrder.source} variant="button" />
          )}
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
          <MoreMenu projectId={projectId} workOrder={workOrder} onDeleted={onDeleted} />
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          {controls}
        </div>
      </div>
      <DescriptionField projectId={projectId} workOrder={workOrder} />
    </header>
  )
}
