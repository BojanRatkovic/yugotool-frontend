import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

import { Inline, leadSentence, ReviewText } from '@/components/review-text'
import { StationIcon } from '@/components/station-icon'
import type { Finding, Run, Station } from '@/lib/contracts'
import { cn } from '@/lib/utils'

const SEVERITIES: {
  key: Finding['severity']
  label: string
  icon: LucideIcon
  iconClass: string
}[] = [
  { key: 'critical', label: 'Critical', icon: CircleAlert, iconClass: 'text-status-failed' },
  {
    key: 'important',
    label: 'Important',
    icon: TriangleAlert,
    iconClass: 'text-status-waiting',
  },
  { key: 'minor', label: 'Minor', icon: Info, iconClass: 'text-muted-foreground' },
]

/** The verdict's first sentence as its headline, the evidence under it. */
function VerdictSummary({ summary }: { summary: string }) {
  const [lead, rest] = leadSentence(summary)
  return (
    <div className="flex max-w-[72ch] flex-col gap-1 text-[0.8125rem] leading-relaxed">
      <p className="font-medium">
        <Inline text={lead} />
      </p>
      {rest === '' ? null : <ReviewText text={rest} className="text-foreground/80" />}
    </div>
  )
}

/** The claim as a headline, the reasoning muted under it. */
function FindingMessage({ message }: { message: string }) {
  const [lead, rest] = leadSentence(message)
  return (
    <>
      <p className="text-[0.8125rem] leading-5 font-medium">
        <Inline text={lead} />
      </p>
      {rest === '' ? null : (
        <p className="max-w-[80ch] text-[0.8125rem] leading-relaxed text-muted-foreground">
          <Inline text={rest} />
        </p>
      )}
    </>
  )
}

/** Validator verdicts of the run: summary first, then findings grouped by severity. */
export function FindingsView({ run, stations }: { run: Run; stations: Station[] }) {
  const stationByKey = new Map(stations.map((station) => [station.key, station]))
  const verdicts = run.stations.filter((sr) => sr.verdict !== null)

  if (verdicts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1 p-6">
        <p className="text-sm font-medium">No findings</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          Validator stations report findings here once they have run.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {verdicts.map((sr) => {
        const verdict = sr.verdict
        if (verdict === null) return null
        const passed = verdict.verdict === 'pass'
        const station = stationByKey.get(sr.stationKey)
        return (
          <article key={sr.id} className="flex flex-col gap-4">
            <header className="flex flex-col gap-2 rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <StationIcon kind="agent" className="text-muted-foreground" />
                <h3 className="text-[0.8125rem] font-semibold">
                  {station?.name ?? sr.stationKey}
                </h3>
                {sr.attempt > 1 ? (
                  <span className="text-xs text-muted-foreground">attempt {sr.attempt}</span>
                ) : null}
                <span
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 text-xs font-medium',
                    passed ? 'text-status-passed' : 'text-status-failed',
                  )}
                >
                  {passed ? (
                    <CircleCheck aria-hidden="true" className="size-3.5" />
                  ) : (
                    <CircleX aria-hidden="true" className="size-3.5" />
                  )}
                  {passed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <VerdictSummary summary={verdict.summary} />
            </header>
            {SEVERITIES.map((severity) => {
              const findings = verdict.findings.filter(
                (finding) => finding.severity === severity.key,
              )
              if (findings.length === 0) return null
              const Icon = severity.icon
              return (
                <section
                  key={severity.key}
                  aria-label={`${severity.label} findings`}
                  className="flex flex-col gap-1"
                >
                  <h4 className="label-caps flex items-center gap-1.5">
                    {severity.label}
                    <span className="font-mono tabular-nums">{findings.length}</span>
                  </h4>
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {findings.map((finding, index) => (
                      <li
                        key={index}
                        className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-2 px-3 py-2"
                      >
                        <Icon
                          aria-hidden="true"
                          className={cn('mt-0.5 size-3.5', severity.iconClass)}
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <FindingMessage message={finding.message} />
                          {finding.file === null ? null : (
                            <p className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                              {finding.file}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </article>
        )
      })}
    </div>
  )
}

/** Count for the Findings tab label. */
export function findingCount(run: Run | undefined): number {
  return (run?.stations ?? []).reduce((sum, sr) => sum + (sr.verdict?.findings.length ?? 0), 0)
}
