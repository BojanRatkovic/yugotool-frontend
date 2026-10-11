import { useForm, useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Plus,
  Save,
  ScanEye,
  ShieldCheck,
  SquareTerminal,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { STATION_KIND_HINT, STATION_KIND_LABEL } from '@/components/station-icon'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSaveLine } from '@/features/projects/api/line-queries'
import { LineCanvas } from '@/features/projects/components/line-canvas'
import { StationEditor } from '@/features/projects/components/station-editor'
import {
  insertAfter,
  lineIssues,
  moveStation,
  newStation,
  removeStation,
  replaceStation,
  sameStations,
  type StationKind,
} from '@/features/projects/utils/line-draft'
import { errorIssues, errorMessage } from '@/lib/api-client'
import type { Line, LineKind, Station } from '@/lib/contracts'
import { skillQueries } from '@/lib/skill-queries'

const EMPTY_ISSUES: ReadonlyMap<string, string> = new Map()

/**
 * Line editor. The draft line is a TanStack Form value; the canvas renders the
 * draft and the side sheet edits the selected station. Save PUTs the whole
 * line. Mount with `key={line.updatedAt}` so a saved/refetched line resets it.
 */
export function LineEditor({
  line,
  previewMissing,
  onSetupPreview,
  kind = 'build',
}: {
  line: Line
  /** `review`: the line a YugoTool review of a PR runs (spec 0009); it only reads. */
  kind?: LineKind
  /** The project has no preview config; QA stations warn about it. */
  previewMissing: boolean
  onSetupPreview: () => void
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const save = useSaveLine(line.projectId, kind)
  const skills = useQuery(skillQueries.list(line.projectId)).data

  const form = useForm({
    defaultValues: { stations: line.stations },
    onSubmit: ({ value }) => {
      save.mutate(
        { stations: value.stations },
        {
          onSuccess: () => toast.success('Line saved.'),
          onError: (error) => toast.error(`Couldn't save the line: ${errorMessage(error)}`),
        },
      )
    },
  })

  const stations = useStore(form.store, (state) => state.values.stations)
  const isDirty = useMemo(
    () => !sameStations(stations, line.stations),
    [stations, line.stations],
  )
  const issues = useMemo(() => lineIssues(stations, kind), [stations, kind])
  const invalidKeys = useMemo(() => new Set(issues.byStation.keys()), [issues])
  const selected = stations.find((station) => station.key === selectedKey)
  const selectedIndex = stations.findIndex((station) => station.key === selectedKey)

  const setStations = (next: Station[]) => form.setFieldValue('stations', next)
  const onSelect = useCallback((key: string) => setSelectedKey(key), [])

  function add(stationKind: StationKind) {
    const station = newStation(stationKind, stations)
    setStations(insertAfter(stations, selectedKey, station))
    setSelectedKey(station.key)
  }

  const apiIssues = save.error === null ? [] : errorIssues(save.error)
  const canSave = isDirty && issues.general.length === 0 && invalidKeys.size === 0

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AddStationButtons onAdd={add} label="Add" kind={kind} />
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {save.isPending
            ? 'Saving…'
            : isDirty
              ? invalidKeys.size > 0 || issues.general.length > 0
                ? 'Unsaved changes — fix the highlighted stations'
                : 'Unsaved changes'
              : 'Saved'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!isDirty || save.isPending}
          onClick={() => {
            form.reset({ stations: line.stations })
            save.reset()
            setSelectedKey(null)
          }}
        >
          <Undo2 aria-hidden="true" />
          Discard
        </Button>
        <Button
          size="sm"
          disabled={!canSave || save.isPending}
          onClick={() => void form.handleSubmit()}
        >
          <Save aria-hidden="true" />
          Save line
        </Button>
      </div>

      {/* An empty line has the canvas hint instead of the schema's "too small" issue. */}
      {(issues.general.length > 0 && stations.length > 0) || save.error !== null ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {save.error === null ? null : (
            <p className="font-medium text-destructive">{errorMessage(save.error)}</p>
          )}
          <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
            {[...issues.general, ...apiIssues].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {stations.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="flex max-w-sm flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium">No stations yet</p>
              <p className="text-[0.8125rem] text-muted-foreground">
                {kind === 'review'
                  ? 'A review line reads a pull request, left to right: a reviewer agent with a structured review, optionally checks and QA. Add the first station above.'
                  : 'A line is the stations every work order passes through, left to right. Add the first one with the buttons above.'}
              </p>
            </div>
          </div>
        ) : null}
        <LineCanvas
          stations={stations}
          selectedKey={selectedKey}
          invalidKeys={invalidKeys}
          previewMissing={previewMissing}
          onSelect={onSelect}
        />
      </div>

      <Sheet
        open={selected !== undefined}
        onOpenChange={(open) => (open ? null : setSelectedKey(null))}
      >
        <SheetContent className="flex w-full flex-col gap-0 data-[side=right]:w-[min(760px,92vw)] data-[side=right]:sm:max-w-none">
          {selected === undefined ? null : (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name || 'Unnamed station'}</SheetTitle>
                <SheetDescription>
                  {STATION_KIND_LABEL[selected.kind]} ·{' '}
                  <span className="font-mono">{selected.key}</span> · station{' '}
                  {selectedIndex + 1} of {stations.length}
                </SheetDescription>
              </SheetHeader>
              <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <StationEditor
                  station={selected}
                  issues={issues.byStation.get(selected.key) ?? EMPTY_ISSUES}
                  onChange={(station) => setStations(replaceStation(stations, station))}
                  previewMissing={previewMissing}
                  lineKind={kind}
                  skills={skills}
                  onSetupPreview={() => {
                    // One sheet at a time: the draft stays, the settings sheet takes over.
                    setSelectedKey(null)
                    onSetupPreview()
                  }}
                />
              </div>
              <SheetFooter className="flex-col gap-2 border-t">
                <AddStationButtons onAdd={add} label="Add after" kind={kind} />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Move left"
                    disabled={selectedIndex <= 0}
                    onClick={() => setStations(moveStation(stations, selected.key, -1))}
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Move right"
                    disabled={selectedIndex >= stations.length - 1}
                    onClick={() => setStations(moveStation(stations, selected.key, 1))}
                  >
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      setStations(removeStation(stations, selected.key))
                      setSelectedKey(null)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete station
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
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

function AddStationButtons({
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
