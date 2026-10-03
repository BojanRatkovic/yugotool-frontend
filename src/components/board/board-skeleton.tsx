import { Skeleton } from '@/components/ui/skeleton'

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
