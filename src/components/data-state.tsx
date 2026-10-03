import { Skeleton } from '@/components/ui/skeleton'

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={className ?? 'flex flex-col gap-2'} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function LoadError({ what, message }: { what: string; message: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">Couldn&rsquo;t load {what}.</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
