import {
  CircleCheck,
  CircleMinus,
  CircleSlash,
  CircleX,
  ExternalLink,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react'

import type { PrCheck, PullRequestDetail } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const STATE: Record<PrCheck['state'], { Icon: LucideIcon; className: string; label: string }> =
  {
    fail: { Icon: CircleX, className: 'text-status-failed', label: 'Failed' },
    pending: {
      Icon: LoaderCircle,
      className: 'text-status-running animate-spin',
      label: 'Running',
    },
    pass: { Icon: CircleCheck, className: 'text-status-passed', label: 'Passed' },
    skipping: { Icon: CircleMinus, className: 'text-status-skipped', label: 'Skipped' },
    cancel: { Icon: CircleSlash, className: 'text-status-cancelled', label: 'Cancelled' },
  }

/** "6/7 passed · 1 failed · 2 skipped", like the CI station. */
export function checksSummary(checks: PrCheck[]): string {
  const count = (state: PrCheck['state']) => checks.filter((c) => c.state === state).length
  const relevant = checks.filter((c) => c.state !== 'skipping' && c.state !== 'cancel').length
  const parts = [`${count('pass')}/${relevant} passed`]
  if (count('fail') > 0) parts.push(`${count('fail')} failed`)
  if (count('pending') > 0) parts.push(`${count('pending')} running`)
  if (count('skipping') > 0) parts.push(`${count('skipping')} skipped`)
  return parts.join(' · ')
}

/** The head commit's checks: failing first, then running, passed, skipped. */
export function PrChecksTab({ pr }: { pr: PullRequestDetail }) {
  if (pr.checks.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        This repository runs no checks on the PR.
      </p>
    )
  }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
        <p className="text-[0.8125rem] font-medium">{checksSummary(pr.checks)}</p>
        <ul className="flex flex-col divide-y rounded-lg border bg-card">
          {pr.checks.map((check, index) => {
            const state = STATE[check.state]
            return (
              <li
                key={`${check.workflow ?? ''}/${check.name}/${index}`}
                className="flex items-center gap-3 px-3 py-2"
              >
                <state.Icon
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', state.className)}
                />
                <span className="sr-only">{state.label}:</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.8125rem]">{check.name}</span>
                  {check.workflow === null ? null : (
                    <span className="truncate text-xs text-muted-foreground">
                      {check.workflow}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    state.className.replace('animate-spin', ''),
                  )}
                >
                  {state.label}
                </span>
                {check.url === null ? null : (
                  <a
                    href={check.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${check.name}`}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                )}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Rerunning failed checks comes later; use the links meanwhile.
        </p>
      </div>
    </div>
  )
}
