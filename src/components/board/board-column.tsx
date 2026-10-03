import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A kanban column: header (icon, title with a hint tooltip, count, anything
 * trailing) over a card list that scrolls on its own. Full board height.
 */
export function BoardColumn({
  title,
  icon,
  hint,
  count,
  scrollKey,
  trailing,
  children,
}: {
  title: string
  icon: React.ReactNode
  /** What the column means, shown on hover/focus of its title. */
  hint: string
  count: number
  /** `data-column-scroll` value of the card list. */
  scrollKey: string
  /** Header content after the count (chips, a menu). */
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    // Full board height; the header stays put and only the card list scrolls.
    <section aria-label={title} className="flex min-h-0 w-72 shrink-0 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-2 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Focusable so the column's purpose is reachable by keyboard too. */}
            <span
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- reveals the column's help
              tabIndex={0}
              className="flex min-w-0 items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {icon}
              <h2 className="truncate text-[0.8125rem] font-semibold">{title}</h2>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{hint}</TooltipContent>
        </Tooltip>
        <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {count}
        </span>
        {trailing}
      </header>
      <div
        data-column-scroll={scrollKey}
        className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-2 overflow-y-auto overscroll-y-contain rounded-lg bg-muted/30 p-1.5"
      >
        {children}
      </div>
    </section>
  )
}
