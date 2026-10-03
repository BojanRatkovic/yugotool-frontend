import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleX,
  FolderCog,
  LoaderCircle,
  RotateCw,
  type LucideIcon,
} from 'lucide-react'

import { CopyButton } from '@/components/copy-button'
import { LoadError } from '@/components/data-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { systemQueries } from '@/features/system/api/system-queries'
import { useId, useState } from 'react'

import { blockingChecks, doctorSummary } from '@/features/system/utils/doctor'
import type { DoctorCheck, DoctorReport } from '@/lib/contracts'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Anchor for "Open Doctor" links. */
export const DOCTOR_ANCHOR = 'doctor'

/**
 * ok → passed (green check) · warn → queued (slate, alert circle): an optional
 * piece is missing or works with a caveat; it limits a feature, it doesn't
 * stop runs · fail → failed (red x): a required piece is missing.
 */
const STATUS: Record<DoctorCheck['status'], { icon: LucideIcon; word: string; tone: string }> =
  {
    ok: { icon: CircleCheck, word: 'OK', tone: 'text-status-passed' },
    warn: { icon: CircleAlert, word: 'Limited', tone: 'text-status-queued' },
    fail: { icon: CircleX, word: 'Blocking', tone: 'text-status-failed' },
  }

/**
 * Settings → Doctor: one row per first-run check with the fix and a copyable
 * command. `onFixRepos` jumps to the Repos folder field.
 */
export function DoctorSection({ onFixRepos }: { onFixRepos?: () => void }) {
  const doctor = useQuery(systemQueries.doctor())
  const report = doctor.data
  return (
    <section
      id={DOCTOR_ANCHOR}
      aria-labelledby="doctor-heading"
      className="flex scroll-mt-4 flex-col gap-2.5"
    >
      <div className="flex items-end gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="doctor-heading" className="flex items-center gap-2 text-sm font-semibold">
            Doctor
            {report === undefined ? null : <ReadyChip report={report} />}
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            What ZASTAVA needs on this machine. Required checks stop runs; optional ones turn
            off one feature.
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {report === undefined ? null : (
            <span
              className="text-xs text-muted-foreground tabular-nums"
              title={formatDateTime(report.checkedAt)}
            >
              Checked {formatRelative(report.checkedAt)}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={doctor.isFetching}
            onClick={() => void doctor.refetch()}
          >
            {doctor.isFetching ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <RotateCw aria-hidden="true" />
            )}
            {/* Same label while checking, so the header doesn't shift. */}
            Run checks again
          </Button>
        </div>
      </div>
      {report !== undefined ? (
        <DoctorChecks report={report} busy={doctor.isFetching} onFixRepos={onFixRepos} />
      ) : doctor.isPending ? (
        <DoctorSkeleton />
      ) : (
        <LoadError
          what="the doctor checks"
          message={doctor.error?.message ?? 'The API returned no report.'}
        />
      )}
    </section>
  )
}

/**
 * Folded to one summary row while nothing blocks runs; opens by itself when a
 * required check fails. Once toggled, the user's choice wins.
 */
function DoctorChecks({
  report,
  busy,
  onFixRepos,
}: {
  report: DoctorReport
  busy: boolean
  onFixRepos?: () => void
}) {
  const summary = doctorSummary(report)
  const [toggled, setToggled] = useState<boolean | null>(null)
  const open = toggled ?? summary.openByDefault
  const listId = useId()
  const status = STATUS[summary.tone]
  const Icon = status.icon
  return (
    <div className="rounded-lg border bg-card" aria-busy={busy}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setToggled(!open)}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[0.8125rem] outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon aria-hidden="true" className={cn('size-4 shrink-0', status.tone)} />
        <span className="min-w-0 flex-1 truncate font-medium">{summary.text}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? 'Hide details' : 'Details'}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <ul id={listId} className="divide-y border-t">
          {report.checks.map((check) => (
            <CheckRow
              key={check.key}
              check={check}
              onFixRepos={check.key === 'repos' ? onFixRepos : undefined}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function ReadyChip({ report }: { report: DoctorReport }) {
  const blocking = blockingChecks(report).length
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full px-1.5 pr-2 text-[0.6875rem] leading-none font-medium whitespace-nowrap tabular-nums',
        report.ready
          ? 'bg-status-passed-soft text-status-passed'
          : 'bg-status-failed-soft text-status-failed',
      )}
    >
      {report.ready ? (
        <CircleCheck aria-hidden="true" className="size-3" />
      ) : (
        <CircleX aria-hidden="true" className="size-3" />
      )}
      {report.ready
        ? 'Ready to run work'
        : `${blocking} required ${blocking === 1 ? 'check' : 'checks'} failing`}
    </span>
  )
}

function CheckRow({ check, onFixRepos }: { check: DoctorCheck; onFixRepos?: () => void }) {
  const status = STATUS[check.status]
  const Icon = status.icon
  const showFix = check.status !== 'ok'
  return (
    <li className="flex min-h-12 items-start gap-3 px-4 py-3">
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', status.tone)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
          <span className="font-medium">{check.label}</span>
          <span className="break-words text-muted-foreground">{check.detail}</span>
        </p>
        {check.required ? null : (
          <p className="text-xs text-muted-foreground">
            Optional{check.neededFor === null ? '' : ` · ${check.neededFor}`}
          </p>
        )}
        {showFix && check.fix !== null ? <p className="text-xs">{check.fix}</p> : null}
        {showFix && check.fixCommand !== null ? (
          <div className="flex max-w-full items-center gap-1 self-start rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2.5">
            <code className="min-w-0 font-mono text-xs break-all">{check.fixCommand}</code>
            <CopyButton
              value={check.fixCommand}
              label={`Copy the ${check.label} fix command`}
            />
          </div>
        ) : null}
        {showFix && onFixRepos !== undefined ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={onFixRepos}
          >
            <FolderCog aria-hidden="true" />
            Set repos folder
          </Button>
        ) : null}
      </div>
      <span className={cn('shrink-0 pt-px text-xs font-medium', status.tone)}>
        {status.word}
      </span>
    </li>
  )
}

function DoctorSkeleton() {
  // Shaped like the folded summary row, the usual state once checks return.
  return (
    <div
      className="flex min-h-12 items-center gap-3 rounded-lg border bg-card px-4 py-3"
      aria-busy="true"
      aria-label="Checking"
    >
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="ml-auto h-3.5 w-12" />
    </div>
  )
}
