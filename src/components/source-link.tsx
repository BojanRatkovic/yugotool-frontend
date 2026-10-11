import { ProductiveMark } from '@/components/productive-mark'
import { Button } from '@/components/ui/button'
import type { WorkOrderSource } from '@/lib/contracts'
import { cn } from '@/lib/utils'

/** "#123", or "Task" when the provider has no number. */
function sourceLabel(source: WorkOrderSource): string {
  return source.number === null ? 'Task' : `#${source.number.replace(/^#/, '')}`
}

function sourceTitle(source: WorkOrderSource): string {
  const where = source.projectName === null ? '' : ` · ${source.projectName}`
  return `Open ${sourceLabel(source)} in Productive${where}`
}

/**
 * Where an imported work order came from (spec 0019): a link to the task.
 * `chip` sits on a board card (above its stretched click target), `button`
 * in the work order header.
 */
export function SourceLink({
  source,
  variant = 'chip',
  className,
}: {
  source: WorkOrderSource
  variant?: 'chip' | 'button'
  className?: string
}) {
  if (variant === 'button')
    return (
      <Button asChild variant="ghost" size="sm" className={cn('font-mono text-xs', className)}>
        <a href={source.url} target="_blank" rel="noreferrer" title={sourceTitle(source)}>
          <ProductiveMark className="size-3.5" />
          {sourceLabel(source)}
        </a>
      </Button>
    )
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      title={sourceTitle(source)}
      aria-label={sourceTitle(source)}
      className={cn(
        'relative z-10 inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-sm border px-1.5 font-mono text-[0.6875rem] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <ProductiveMark className="size-3" />
      {sourceLabel(source)}
    </a>
  )
}
