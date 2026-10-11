import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Meter } from '@/components/meter'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { systemQueries } from '@/features/system/api/system-queries'
import type { AccountPlanUsage, UsageWindow } from '@/lib/contracts'
import { formatDateTime } from '@/lib/format'

/** "resets 01:00" within a day, "resets Sat" beyond. */
export function resetLabel(iso: string, now = Date.now()): string {
  const date = new Date(iso)
  if (date.getTime() - now < 24 * 3_600_000) {
    return `resets ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  }
  return `resets ${date.toLocaleDateString('en-GB', { weekday: 'short' })}`
}

function WindowRow({ name, window }: { name: string; window: UsageWindow }) {
  const value = window.utilization ?? 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-sidebar-foreground">{name}</span>
        <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {window.utilization === null ? '—' : `${Math.round(value)}%`}
        </span>
      </div>
      <Meter value={value} label={`${name} plan usage`} />
      {window.resetsAt === null ? null : (
        <span
          className="text-[0.6875rem] text-muted-foreground"
          title={formatDateTime(window.resetsAt)}
        >
          {resetLabel(window.resetsAt)}
        </span>
      )}
    </div>
  )
}

function planName(type: string | null): string {
  if (type === null) return 'Plan'
  return `Plan · ${type.charAt(0).toUpperCase()}${type.slice(1)}`
}

function percent(window: UsageWindow | null): string {
  return window?.utilization === null || window === null
    ? '—'
    : `${Math.round(window.utilization)}%`
}

/** One account in the popover: its plan and both windows, or why there are none. */
function AccountUsageRow({ entry }: { entry: AccountPlanUsage }) {
  const { usage } = entry
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <span className="truncate text-xs font-medium">{entry.label}</span>
      {usage.available ? (
        <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {planName(usage.subscriptionType)} · 5-hour {percent(usage.fiveHour)} · weekly{' '}
          {percent(usage.sevenDay)}
        </span>
      ) : (
        <span className="text-[0.6875rem] text-muted-foreground">
          {usage.error ?? 'No plan limits (API key).'}
        </span>
      )}
    </li>
  )
}

/** Every account's plan (spec 0016): a full account pauses only its own projects. */
function AccountsPopover() {
  const [open, setOpen] = useState(false)
  const accounts = useQuery({ ...systemQueries.usageByAccount(), enabled: open })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="-mr-1 inline-flex items-center gap-0.5 rounded-sm px-1 text-[0.6875rem] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          Accounts
          <ChevronDown aria-hidden="true" className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3">
        <h3 className="label-caps pb-2">Plan usage by account</h3>
        {accounts.isPending ? (
          <Skeleton className="h-10 w-full" />
        ) : accounts.data === undefined ? (
          <p className="text-xs text-muted-foreground">Usage unavailable.</p>
        ) : (
          <ul className="divide-y">
            {accounts.data.map((entry) => (
              <AccountUsageRow key={entry.accountId ?? 'machine'} entry={entry} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Sidebar footer meter: the default account's 5-hour and weekly limits. */
export function PlanUsageCard() {
  const { data, isPending, error } = useQuery(systemQueries.usage())

  return (
    <section
      aria-label="Plan usage"
      className="flex flex-col gap-3 rounded-lg border border-sidebar-border bg-background/60 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-caps">
          {data === undefined ? 'Plan' : planName(data.subscriptionType)}
        </h2>
        <AccountsPopover />
      </div>
      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      ) : data === undefined ? (
        <p className="text-xs text-muted-foreground">
          Usage unavailable{error === null ? '.' : ` — ${error.message}`}
        </p>
      ) : !data.available ? (
        <p className="text-xs text-muted-foreground">
          {data.error ?? 'No plan limits — sessions bill per token on an API key.'}
        </p>
      ) : (
        <>
          {data.fiveHour === null ? null : <WindowRow name="5-hour" window={data.fiveHour} />}
          {data.sevenDay === null ? null : <WindowRow name="Weekly" window={data.sevenDay} />}
          {data.sevenDayOpus === null ? null : (
            <WindowRow name="Weekly · Opus" window={data.sevenDayOpus} />
          )}
        </>
      )}
    </section>
  )
}
