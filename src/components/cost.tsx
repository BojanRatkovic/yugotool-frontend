import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AuthSource } from '@/lib/contracts'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/utils'

const ESTIMATE_HINT = 'API-equivalent estimate. Billed to your Max plan, not per token.'

/**
 * `$0.18` in mono. On a subscription the number is an API-equivalent estimate,
 * so it carries a muted `est.` suffix and says so in a tooltip.
 */
export function Cost({
  usd,
  authSource,
  className,
  plain = false,
}: {
  usd: number
  authSource: AuthSource | null | undefined
  className?: string
  /** Inside another control (a button): no focusable tooltip, a title instead. */
  plain?: boolean
}) {
  const value = <span className="font-mono tabular-nums">{formatUsd(usd)}</span>
  if (authSource !== 'subscription') {
    return <span className={cn('whitespace-nowrap', className)}>{value}</span>
  }
  if (plain) {
    return (
      <span title={ESTIMATE_HINT} className={cn('whitespace-nowrap', className)}>
        {value}
        <span className="ml-1 text-[0.6875rem] text-muted-foreground">est.</span>
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the tooltip carries the meaning of "est."
          tabIndex={0}
          className={cn('cursor-help whitespace-nowrap', className)}
        >
          {value}
          <span className="ml-1 text-[0.6875rem] text-muted-foreground">est.</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{ESTIMATE_HINT}</TooltipContent>
    </Tooltip>
  )
}
