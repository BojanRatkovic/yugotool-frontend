import { useQuery } from '@tanstack/react-query'
import {
  Archive,
  CircleAlert,
  CircleCheck,
  Eye,
  GitMerge,
  GitPullRequestDraft,
  Hourglass,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef } from 'react'

import { BoardColumn } from '@/components/board/board-column'
import { BoardSkeleton } from '@/components/board/board-skeleton'
import { LoadError } from '@/components/data-state'
import { Button } from '@/components/ui/button'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { PrCard } from '@/features/pull-requests/components/pr-card'
import { buildPrColumns, type PrColumnKey } from '@/features/pull-requests/utils/columns'
import { useNow } from '@/hooks/use-now'
import { useShiftWheel } from '@/hooks/use-shift-wheel'
import { ApiError } from '@/lib/api-client'
import type { PrScope } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const COLUMN_ICON: Record<PrColumnKey, LucideIcon> = {
  draft: GitPullRequestDraft,
  needs_work: CircleAlert,
  ready: GitMerge,
  in_review: Eye,
  to_review: Eye,
  re_review: RefreshCw,
  waiting_author: Hourglass,
  approved: CircleCheck,
  done: Archive,
}

/** A pull request board: columns by whose move it is (spec 0008 §3, §6.2). */
export function PrBoard({
  projectId,
  scope,
  teams,
  onOpen,
  onEditDelivery,
}: {
  projectId: string
  scope: PrScope
  teams: boolean
  onOpen: (number: number) => void
  /** Opens Project settings → Delivery (where the remote is explained). */
  onEditDelivery: () => void
}) {
  const list = useQuery(prQueries.list(projectId, scope, teams))
  const now = useNow(60_000, true)
  const columns = useMemo(
    () => (list.data === undefined ? [] : buildPrColumns(list.data.items, scope, now)),
    [list.data, scope, now],
  )
  const boardRef = useRef<HTMLDivElement>(null)
  useShiftWheel(boardRef)

  if (list.data === undefined) {
    if (list.error instanceof ApiError && list.error.code === 'pull_requests_unavailable') {
      return <Unavailable reason={list.error.message} onEditDelivery={onEditDelivery} />
    }
    if (list.error !== null) {
      return (
        <div className="p-4">
          <LoadError what="pull requests" message={list.error.message} />
        </div>
      )
    }
    return <BoardSkeleton columns={5} />
  }

  if (list.data.items.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No pull requests here in the last 14 days.
      </p>
    )
  }

  return (
    <div
      ref={boardRef}
      data-board
      className="fade-x flex h-full min-h-0 [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--muted-foreground)_45%,transparent)_transparent] gap-3 overflow-x-auto overflow-y-hidden px-4 pb-3"
    >
      {columns.map((column) => {
        const Icon = COLUMN_ICON[column.key]
        return (
          <BoardColumn
            key={column.key}
            title={column.title}
            hint={column.hint}
            count={column.items.length}
            scrollKey={column.key}
            icon={
              <Icon
                aria-hidden="true"
                className={cn(
                  'size-3.5 shrink-0',
                  column.needsYou ? 'text-status-waiting' : 'text-muted-foreground',
                )}
              />
            }
          >
            {column.items.length === 0 ? (
              <p className="px-1.5 py-2 text-xs text-muted-foreground">{column.empty}</p>
            ) : (
              column.items.map(({ pr, placement }) => (
                <PrCard
                  key={pr.number}
                  pr={pr}
                  placement={placement}
                  needsYou={column.needsYou}
                  showAuthor={scope === 'assigned'}
                  onOpen={onOpen}
                  now={now}
                />
              ))
            )}
          </BoardColumn>
        )
      })}
    </div>
  )
}

/** The project can't have pull requests here: say why and where to fix it. */
function Unavailable({
  reason,
  onEditDelivery,
}: {
  reason: string
  onEditDelivery: () => void
}) {
  return (
    <div className="m-4 max-w-xl rounded-lg border bg-muted/30 p-4">
      <p className="text-sm font-medium">
        Pull requests aren&rsquo;t available for this project.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onEditDelivery}>
        Project settings → Delivery
      </Button>
    </div>
  )
}
