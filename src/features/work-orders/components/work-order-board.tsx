import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useLiveQuery } from '@tanstack/react-db'
import { CircleCheck, CircleDashed, Ellipsis, ListEnd, Moon, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { LoadError } from '@/components/data-state'
import { modelLabel } from '@/components/model-select'
import { STATION_KIND_HINT, StationIcon } from '@/components/station-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRunBacklog } from '@/features/work-orders/api/work-order-mutations'
import { workOrdersCollection } from '@/features/work-orders/api/work-orders-collection'
import { NewWorkOrderForm } from '@/features/work-orders/components/new-work-order-form'
import {
  SortableWorkOrderCard,
  WorkOrderCard,
} from '@/features/work-orders/components/work-order-card'
import {
  BACKLOG,
  buildColumns,
  DONE,
  positionBetween,
  type BoardColumn,
} from '@/features/work-orders/utils/board-columns'
import { errorMessage } from '@/lib/api-client'
import type { QueueMode, Station } from '@/lib/contracts'
import { queryKeys } from '@/lib/query-keys'
import { useQueryError } from '@/lib/use-query-error'

/**
 * Shift + wheel scrolls the board sideways on every platform (macOS converts
 * it natively; a plain mouse wheel on Windows/Linux reports deltaY only).
 */
function useShiftWheel(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const board = ref.current
    if (board === null) return undefined
    function onWheel(event: WheelEvent) {
      if (!event.shiftKey || event.deltaX !== 0 || event.deltaY === 0 || board === null) return
      event.preventDefault()
      board.scrollLeft += event.deltaY
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  })
}

export function WorkOrderBoard({
  projectId,
  stations,
  onOpen,
  onCreate,
}: {
  projectId: string
  stations: Station[]
  onOpen: (workOrderId: string) => void
  /** Opens the app-level "New work order" dialog; without it the backlog adds inline. */
  onCreate?: () => void
}) {
  const collection = workOrdersCollection(projectId)
  const { data: workOrders, isLoading } = useLiveQuery(
    (q) => q.from({ workOrder: collection }),
    [collection],
  )
  const error = useQueryError(queryKeys.workOrdersByProject(projectId))
  const columns = useMemo(() => buildColumns(stations, workOrders), [stations, workOrders])
  const boardRef = useRef<HTMLDivElement>(null)

  useShiftWheel(boardRef)

  if (isLoading && error !== null) {
    return <LoadError what="work orders" message={error.message} />
  }
  if (isLoading) return <BoardSkeleton columns={stations.length + 2} />

  return (
    // The board scrolls sideways; each column's card list scrolls on its own.
    // Columns contain only vertical overscroll, so a horizontal swipe over a
    // card still reaches the board.
    <div
      ref={boardRef}
      data-board
      className="fade-x flex h-full min-h-0 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_45%,transparent)_transparent] gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3"
    >
      {columns.map((column) =>
        column.key === BACKLOG ? (
          <BacklogColumn
            key={column.key}
            column={column}
            projectId={projectId}
            stations={stations}
            onOpen={onOpen}
            onCreate={onCreate}
          />
        ) : (
          <Column key={column.key} column={column}>
            {column.items.map((workOrder) => (
              <WorkOrderCard
                key={workOrder.id}
                workOrder={workOrder}
                stations={stations}
                onOpen={onOpen}
              />
            ))}
          </Column>
        ),
      )}
    </div>
  )
}

/** Skeleton matching the board: column headers plus a few card-shaped blocks. */
export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex h-full gap-3 overflow-hidden px-4" aria-busy="true">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="flex w-72 shrink-0 flex-col gap-2">
          <div className="flex h-9 items-center gap-2 px-1">
            <Skeleton className="size-3.5 rounded-sm" />
            <Skeleton className="h-3 w-20" />
          </div>
          {Array.from({ length: column % 2 === 0 ? 2 : 1 }, (_unused, card) => (
            <Skeleton key={card} className="h-18 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  )
}

function ColumnIcon({ column }: { column: BoardColumn }) {
  if (column.station !== null) {
    return (
      <StationIcon
        kind={column.station.kind}
        className={
          column.station.kind === 'gate' ? 'text-status-waiting' : 'text-muted-foreground'
        }
      />
    )
  }
  const Icon = column.key === DONE ? CircleCheck : CircleDashed
  return <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
}

function columnHint(column: BoardColumn): string {
  if (column.station !== null) return STATION_KIND_HINT[column.station.kind]
  return column.key === DONE
    ? 'Delivered: PR opened or committed.'
    : 'Not started yet. Start a work order to send it down the line.'
}

function Column({
  column,
  action,
  children,
}: {
  column: BoardColumn
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const station = column.station
  return (
    // Full board height; the header stays put and only the card list scrolls.
    <section aria-label={column.title} className="flex min-h-0 w-72 shrink-0 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-2 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Focusable so the column's purpose is reachable by keyboard too. */}
            <span
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals the column's help
              tabIndex={0}
              className="flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ColumnIcon column={column} />
              <h2 className="truncate text-[0.8125rem] font-semibold">{column.title}</h2>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{columnHint(column)}</TooltipContent>
        </Tooltip>
        <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {column.items.length}
        </span>
        {station?.kind === 'agent' || station?.kind === 'shift' ? (
          <span className="ml-auto truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
            {modelLabel(station.model)}
            {station.effort === undefined ? null : ` · ${station.effort}`}
          </span>
        ) : null}
        {action === undefined ? null : (
          <span
            className={
              station?.kind === 'agent' || station?.kind === 'shift' ? undefined : 'ml-auto'
            }
          >
            {action}
          </span>
        )}
      </header>
      <div
        data-column-scroll={column.key}
        className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-2 overflow-y-auto overscroll-y-contain rounded-lg bg-muted/30 p-1.5"
      >
        {children}
      </div>
    </section>
  )
}

const RUN_BACKLOG_TOAST: Record<QueueMode, (count: number) => string> = {
  asap: (count) =>
    `Queued ${count} work ${count === 1 ? 'order' : 'orders'} — they run as slots free up.`,
  night: (count) =>
    `Queued ${count} work ${count === 1 ? 'order' : 'orders'} for the night shift.`,
}

/** Backlog header menu: queue every backlog order, now or tonight. */
function RunBacklogMenu({ projectId, count }: { projectId: string; count: number }) {
  const runBacklog = useRunBacklog()

  function run(mode: QueueMode) {
    runBacklog.mutate(
      { projectId, mode },
      {
        onSuccess: (queued) =>
          queued === 0
            ? toast.info('Nothing to queue — the backlog is empty.')
            : toast.success(RUN_BACKLOG_TOAST[mode](queued)),
        onError: (error) => toast.error(`Couldn't queue the backlog: ${errorMessage(error)}`),
      },
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Backlog actions"
          disabled={runBacklog.isPending}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="label-caps">Run backlog</DropdownMenuLabel>
        <DropdownMenuItem disabled={count === 0} onSelect={() => run('asap')}>
          <ListEnd aria-hidden="true" />
          Now
          <span className="ml-auto text-xs text-muted-foreground">as slots free up</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={count === 0} onSelect={() => run('night')}>
          <Moon aria-hidden="true" />
          Tonight
          <span className="ml-auto text-xs text-muted-foreground">night shift</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BacklogColumn({
  column,
  projectId,
  stations,
  onOpen,
  onCreate,
}: {
  column: BoardColumn
  projectId: string
  stations: Station[]
  onOpen: (id: string) => void
  onCreate?: () => void
}) {
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    // A small threshold keeps plain clicks as "open card".
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const items = column.items
  const ids = items.map((item) => item.id)
  const create = onCreate ?? (() => setAdding(true))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over === null || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const reordered = arrayMove(items, from, to)
    const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position)
    const tx = workOrdersCollection(projectId).update(String(active.id), (draft) => {
      draft.position = position
    })
    tx.isPersisted.promise.catch((error: unknown) => {
      toast.error(`Couldn't reorder: ${errorMessage(error)}`)
    })
  }

  const lastPosition = items.at(-1)?.position

  return (
    <Column
      column={column}
      action={
        <span className="flex items-center gap-0.5">
          <RunBacklogMenu
            projectId={projectId}
            count={items.filter((item) => item.status === 'backlog').length}
          />
          <Button variant="ghost" size="icon-xs" aria-label="New work order" onClick={create}>
            <Plus aria-hidden="true" />
          </Button>
        </span>
      }
    >
      {adding && onCreate === undefined ? (
        <NewWorkOrderForm
          projectId={projectId}
          position={positionBetween(lastPosition, undefined)}
          onDone={() => setAdding(false)}
        />
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((workOrder) => (
            <SortableWorkOrderCard
              key={workOrder.id}
              workOrder={workOrder}
              stations={stations}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>
      </DndContext>
      {items.length === 0 && !adding ? (
        <button
          type="button"
          onClick={create}
          className="flex h-18 shrink-0 items-center justify-center gap-1.5 rounded-md border border-dashed text-[0.8125rem] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New work order
        </button>
      ) : null}
    </Column>
  )
}
