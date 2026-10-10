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
import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { BoardColumn as BoardColumnShell } from '@/components/board/board-column'
import { BoardSkeleton } from '@/components/board/board-skeleton'
import { LoadError } from '@/components/data-state'
import { modelLabel } from '@/components/model-select'
import { STATION_KIND_HINT, StationIcon } from '@/components/station-icon'
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
import { type BoardHub, boardHub } from '@/features/work-orders/utils/hub-card'
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
import { useShiftWheel } from '@/hooks/use-shift-wheel'
import { queryKeys } from '@/lib/query-keys'
import { useQueryError } from '@/lib/use-query-error'

export function WorkOrderBoard({
  projectId,
  stations,
  onOpen,
  onCreate,
  hubRepos,
}: {
  projectId: string
  stations: Station[]
  onOpen: (workOrderId: string) => void
  /** Opens the app-level "New work order" dialog; without it the backlog adds inline. */
  onCreate?: () => void
  /** A hub project's repos (spec 0014): cards show their repo; undefined for repo projects. */
  hubRepos?: string[]
}) {
  const collection = workOrdersCollection(projectId)
  const { data: workOrders, isLoading } = useLiveQuery(
    (q) => q.from({ workOrder: collection }),
    [collection],
  )
  const error = useQueryError(queryKeys.workOrdersByProject(projectId))
  const columns = useMemo(() => buildColumns(stations, workOrders), [stations, workOrders])
  const hub = useMemo(() => boardHub(hubRepos, workOrders), [hubRepos, workOrders])
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
            hub={hub}
          />
        ) : (
          <Column key={column.key} column={column}>
            {column.items.map((workOrder) => (
              <WorkOrderCard
                key={workOrder.id}
                workOrder={workOrder}
                stations={stations}
                onOpen={onOpen}
                hub={hub}
              />
            ))}
          </Column>
        ),
      )}
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
  const showsModel = station?.kind === 'agent' || station?.kind === 'shift'
  return (
    <BoardColumnShell
      title={column.title}
      icon={<ColumnIcon column={column} />}
      hint={columnHint(column)}
      count={column.items.length}
      scrollKey={column.key}
      trailing={
        <>
          {showsModel ? (
            <span className="ml-auto truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
              {modelLabel(station.model)}
              {station.effort === undefined ? null : ` · ${station.effort}`}
            </span>
          ) : null}
          {action === undefined ? null : (
            <span className={showsModel ? undefined : 'ml-auto'}>{action}</span>
          )}
        </>
      }
    >
      {children}
    </BoardColumnShell>
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
  hub,
}: {
  column: BoardColumn
  projectId: string
  stations: Station[]
  onOpen: (id: string) => void
  onCreate?: () => void
  hub: BoardHub | null
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
          repos={hub?.repos}
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
              hub={hub}
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
