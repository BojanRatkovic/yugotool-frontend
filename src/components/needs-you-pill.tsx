import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Violet count of things waiting on you; nothing when none. */
export function NeedsYouPill({ count }: { count: number }) {
  if (count === 0) return null
  const label = `${count} need${count === 1 ? 's' : ''} you`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-status-waiting px-1 font-mono text-[0.625rem] font-semibold text-background tabular-nums">
          {count}
          <span className="sr-only"> {count === 1 ? 'needs' : 'need'} you</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
