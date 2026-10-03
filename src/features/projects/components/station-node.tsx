import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { TriangleAlert } from 'lucide-react'
import { memo } from 'react'

import { modelLabel } from '@/components/model-select'
import { STATION_KIND_LABEL, StationIcon } from '@/components/station-icon'
import type { Station } from '@/lib/contracts'
import { cn } from '@/lib/utils'

export type StationNode = Node<
  {
    station: Station
    index: number
    invalid: boolean
    /** QA station on a project without a preview config. */
    previewMissing: boolean
  },
  'station'
>

/** The one config value that identifies a station at a glance. */
function identifyingValue(station: Station): string {
  if (station.kind === 'agent') {
    return `${modelLabel(station.model)}${station.effort === undefined ? '' : ` · ${station.effort}`}`
  }
  if (station.kind === 'shift') {
    return `${modelLabel(station.model)} · handoff ${station.handoffAtPct}% · ≤${station.maxShifts}`
  }
  if (station.kind === 'checks') return station.command || '—'
  if (station.kind === 'qa') {
    return `${modelLabel(station.model)}${station.effort === undefined ? '' : ` · ${station.effort}`} · ≥${station.diffThresholdPct}%`
  }
  return station.prompt || '—'
}

function StationNodeView({
  data: { station, index, invalid, previewMissing },
  selected,
}: NodeProps<StationNode>) {
  return (
    <div
      className={cn(
        'relative w-60 cursor-pointer overflow-hidden rounded-lg border bg-card py-3 pr-3 pl-4 transition-colors duration-150',
        invalid ? 'border-status-failed' : 'border-node-border',
        selected && 'outline-2 outline-offset-2 outline-brand',
      )}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {/* Left status edge: neutral in the editor, failed when the station is invalid. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          invalid
            ? 'bg-status-failed'
            : station.kind === 'gate'
              ? 'bg-status-waiting'
              : 'bg-node-border',
        )}
      />
      <div className="flex items-center gap-2">
        <StationIcon
          kind={station.kind}
          className={station.kind === 'gate' ? 'text-status-waiting' : 'text-muted-foreground'}
        />
        <span className="truncate text-[0.8125rem] font-semibold">
          {station.name || 'Unnamed'}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          {STATION_KIND_LABEL[station.kind]}
          <span className="font-mono tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        </span>
      </div>
      <p className="mt-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
        {identifyingValue(station)}
      </p>
      {station.kind === 'shift' ? (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Shift settings">
          <li className="truncate rounded-sm bg-muted px-1.5 font-mono text-[0.6875rem] leading-4 text-muted-foreground">
            {station.doneCommand ?? 'no done command'}
          </li>
          {station.reviewHandoff ? (
            <li className="rounded-sm bg-status-waiting-soft px-1.5 py-0.5 text-[0.6875rem] leading-none text-status-waiting">
              review handoff
            </li>
          ) : null}
        </ul>
      ) : null}
      {station.kind === 'qa' ? (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="QA settings">
          {[...station.viewports, ...station.themes].map((value) => (
            <li
              key={value}
              className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-muted-foreground"
            >
              {value}
            </li>
          ))}
          {station.alwaysCheck.length === 0 ? null : (
            <li className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.6875rem] leading-none text-muted-foreground">
              {station.alwaysCheck.length} pinned{' '}
              {station.alwaysCheck.length === 1 ? 'route' : 'routes'}
            </li>
          )}
          {previewMissing ? (
            <li className="flex items-center gap-1 rounded-sm bg-status-failed-soft px-1.5 py-0.5 text-[0.6875rem] leading-none text-status-failed">
              <TriangleAlert aria-hidden="true" className="size-3" />
              No preview set up
            </li>
          ) : null}
        </ul>
      ) : null}
      {station.kind === 'agent' ? (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Allowed tools">
          {station.allowedTools.map((tool) => (
            <li
              key={tool}
              className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] leading-none text-muted-foreground"
            >
              {tool}
            </li>
          ))}
          {station.structuredVerdict === true ? (
            <li className="rounded-sm bg-status-passed-soft px-1.5 py-0.5 text-[0.6875rem] leading-none text-status-passed">
              verdict
            </li>
          ) : null}
        </ul>
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

export const StationNodeComponent = memo(StationNodeView)
