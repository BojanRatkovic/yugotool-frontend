import { ArrowRight, Check, CircleDot, FileText, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

import type { Shift } from '@/lib/contracts'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { contextPct, END_REASON, formatPct } from '@/features/runs/utils/shifts'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-t first:border-t-0">
      <dt className="label-caps border-r bg-muted/40 px-3 py-2.5">{label}</dt>
      <dd className="min-w-0 px-3 py-2.5 text-[0.8125rem]">{children}</dd>
    </div>
  )
}

function Empty() {
  return <span className="text-muted-foreground">—</span>
}

function Items({
  items,
  icon,
  mono = false,
  numbered = false,
}: {
  items: string[]
  icon?: ReactNode
  mono?: boolean
  numbered?: boolean
}) {
  if (items.length === 0) return <Empty />
  const List = numbered ? 'ol' : 'ul'
  return (
    <List className="flex flex-col gap-1">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className="flex items-start gap-2">
          {numbered ? (
            <span className="w-4 shrink-0 text-right font-mono text-[0.6875rem] leading-5 text-muted-foreground tabular-nums">
              {index + 1}
            </span>
          ) : (
            <span className="mt-[3px] shrink-0">{icon}</span>
          )}
          <span className={cn('min-w-0 break-words', mono && 'font-mono text-xs leading-5')}>
            {item}
          </span>
        </li>
      ))}
    </List>
  )
}

/**
 * One shift's handoff, laid out like a shift-handover form: a header strip
 * (outgoing → incoming shift, when, at what context) and labelled rows.
 */
export function HandoffSheet({ shift }: { shift: Shift }) {
  const handoff = shift.handoff
  const pct = contextPct(shift.contextTokens, shift.contextWindow)
  const reason = shift.endReason === null ? null : END_REASON[shift.endReason]
  return (
    <article
      aria-label={`Shift ${shift.number} handoff`}
      className="overflow-hidden rounded-lg border bg-card"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          Shift handover
          <span className="flex items-center gap-1 font-mono text-[0.8125rem] font-normal text-muted-foreground tabular-nums">
            {shift.number}
            {handoff === null ? null : (
              <>
                <ArrowRight aria-hidden="true" className="size-3" />
                <span className="sr-only">to</span>
                {shift.number + 1}
              </>
            )}
          </span>
        </h3>
        <span className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
          {reason === null ? null : <span>{reason.label}</span>}
          {pct === null ? null : <span>at {formatPct(pct)} context</span>}
          <span>{formatDateTime(shift.finishedAt ?? shift.startedAt)}</span>
        </span>
      </header>
      {handoff === null ? (
        <p className="px-3 py-4 text-[0.8125rem] text-muted-foreground">
          {shift.status === 'running' || shift.status === 'handing_off'
            ? 'This shift is still working — its handoff appears when it hands off.'
            : 'This shift ended without a handoff.'}
        </p>
      ) : (
        <dl>
          <Row label="Summary">
            {handoff.summary === '' ? (
              <Empty />
            ) : (
              <p className="leading-relaxed">{handoff.summary}</p>
            )}
          </Row>
          <Row label="Done">
            <Items
              items={handoff.done}
              icon={<Check aria-hidden="true" className="size-3.5 text-status-passed" />}
            />
          </Row>
          <Row label="In progress">
            {handoff.inProgress === null ? (
              <Empty />
            ) : (
              <p className="flex items-start gap-2 leading-relaxed">
                <CircleDot
                  aria-hidden="true"
                  className="mt-[3px] size-3.5 shrink-0 text-status-running"
                />
                <span className="min-w-0 break-words whitespace-pre-wrap">
                  {handoff.inProgress}
                </span>
              </p>
            )}
          </Row>
          <Row label="Next">
            <Items items={handoff.nextSteps} numbered />
          </Row>
          <Row label="Gotchas">
            <Items
              items={handoff.gotchas}
              icon={
                <TriangleAlert aria-hidden="true" className="size-3.5 text-status-waiting" />
              }
            />
          </Row>
          <Row label="Files">
            <Items
              items={handoff.filesToRead}
              mono
              icon={<FileText aria-hidden="true" className="size-3.5 text-muted-foreground" />}
            />
          </Row>
        </dl>
      )}
    </article>
  )
}
