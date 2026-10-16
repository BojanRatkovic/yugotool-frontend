import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Plus,
  ScanEye,
  ShieldCheck,
  SquareTerminal,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { STATION_KIND_HINT, STATION_KIND_LABEL } from '@/components/station-icon'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StationEditor } from '@/features/projects/components/station-editor'
import {
  moveStation,
  removeStation,
  replaceStation,
  type LineIssues,
  type StationKind,
} from '@/features/projects/utils/line-draft'
import type { LineKind, ProjectSkill, Station } from '@/lib/contracts'

const EMPTY_ISSUES: ReadonlyMap<string, string> = new Map()

/**
 * The side sheet that edits one station of a draft line: its fields, add
 * after, move, delete. The draft is the caller's; `footer` adds its own row.
 */
export function StationSheet({
  stations,
  selectedKey,
  onSelectKey,
  onStations,
  onAdd,
  kind,
  issues,
  skills,
  previewMissing,
  onSetupPreview,
  footer,
}: {
  stations: Station[]
  selectedKey: string | null
  onSelectKey: (key: string | null) => void
  onStations: (stations: Station[]) => void
  onAdd: (kind: StationKind) => void
  kind: LineKind
  issues: LineIssues
  skills: readonly ProjectSkill[] | undefined
  previewMissing: boolean
  onSetupPreview: () => void
  footer?: ReactNode
}) {
  const selected = stations.find((station) => station.key === selectedKey)
  const selectedIndex = stations.findIndex((station) => station.key === selectedKey)
  return (
    <Sheet
      open={selected !== undefined}
      onOpenChange={(open) => (open ? null : onSelectKey(null))}
    >
      <SheetContent className="flex w-full flex-col gap-0 data-[side=right]:w-[min(760px,92vw)] data-[side=right]:sm:max-w-none">
        {selected === undefined ? null : (
          <>
            <SheetHeader>
              <SheetTitle>{selected.name || 'Unnamed station'}</SheetTitle>
              <SheetDescription>
                {STATION_KIND_LABEL[selected.kind]} ·{' '}
                <span className="font-mono">{selected.key}</span> · station {selectedIndex + 1}{' '}
                of {stations.length}
              </SheetDescription>
            </SheetHeader>
            <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <StationEditor
                station={selected}
                issues={issues.byStation.get(selected.key) ?? EMPTY_ISSUES}
                onChange={(station) => onStations(replaceStation(stations, station))}
                previewMissing={previewMissing}
                lineKind={kind}
                skills={skills}
                onSetupPreview={() => {
                  // One sheet at a time: the draft stays, the settings sheet takes over.
                  onSelectKey(null)
                  onSetupPreview()
                }}
              />
            </div>
            <SheetFooter className="flex-col gap-2 border-t">
              <AddStationButtons onAdd={onAdd} label="Add after" kind={kind} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Move left"
                  disabled={selectedIndex <= 0}
                  onClick={() => onStations(moveStation(stations, selected.key, -1))}
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Move right"
                  disabled={selectedIndex >= stations.length - 1}
                  onClick={() => onStations(moveStation(stations, selected.key, 1))}
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    onStations(removeStation(stations, selected.key))
                    onSelectKey(null)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete station
                </Button>
              </div>
              {footer}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const ADD_KINDS: readonly { kind: StationKind; icon: typeof Bot }[] = [
  { kind: 'agent', icon: Bot },
  { kind: 'gate', icon: ShieldCheck },
  { kind: 'checks', icon: SquareTerminal },
  { kind: 'qa', icon: ScanEye },
]

/** A review line only reads: no gates (triage is the gate) and nothing that edits. */
const REVIEW_KINDS: ReadonlySet<StationKind> = new Set(['agent', 'checks', 'qa'])

export function AddStationButtons({
  onAdd,
  label,
  kind: lineKind,
}: {
  onAdd: (kind: StationKind) => void
  label: string
  kind: LineKind
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Plus aria-hidden="true" className="size-3.5" />
        {label}
      </span>
      {ADD_KINDS.filter(({ kind }) => lineKind !== 'review' || REVIEW_KINDS.has(kind)).map(
        ({ kind, icon: Icon }) => (
          <Tooltip key={kind}>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => onAdd(kind)}>
                <Icon aria-hidden="true" />
                {STATION_KIND_LABEL[kind]}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{STATION_KIND_HINT[kind]}</TooltipContent>
          </Tooltip>
        ),
      )}
    </div>
  )
}
