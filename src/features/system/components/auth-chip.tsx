import { useQuery } from '@tanstack/react-query'
import { KeyRound, UserRound } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { systemQueries } from '@/features/system/api/system-queries'
import { cn } from '@/lib/utils'

/** Sidebar footer chip: what new sessions bill against. */
export function AuthChip() {
  const { data, error } = useQuery(systemQueries.info())
  const source = data?.authSource ?? (error === null ? undefined : 'unknown')
  if (source === undefined) return <div className="h-6" />
  const Icon = source === 'api_key' ? KeyRound : UserRound
  const label =
    source === 'subscription'
      ? 'Subscription'
      : source === 'api_key'
        ? 'API key'
        : 'Unknown auth'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- exposes the tooltip to keyboard users
          tabIndex={0}
          className="inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent"
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.5 rounded-full',
              source === 'unknown' ? 'bg-status-cancelled' : 'bg-status-passed',
            )}
          />
          <Icon aria-hidden="true" className="size-3.5" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        {data === undefined
          ? 'The API is unreachable.'
          : `New sessions bill against: ${label}. Repos root: ${data.reposRoot}`}
      </TooltipContent>
    </Tooltip>
  )
}
