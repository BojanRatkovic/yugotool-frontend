import { Save, Undo2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { LineCanvas } from '@/features/projects/components/line-canvas'
import { AddStationButtons, StationSheet } from '@/features/projects/components/station-sheet'
import { useLineDraft } from '@/features/projects/hooks/use-line-draft'
import { errorIssues, errorMessage } from '@/lib/api-client'
import type { Line, LineKind } from '@/lib/contracts'

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
  const {
    form,
    save,
    skills,
    stations,
    setStations,
    selectedKey,
    setSelectedKey,
    add,
    isDirty,
    issues,
    canSave,
  } = useLineDraft(line, kind)
  const invalidKeys = useMemo(() => new Set(issues.byStation.keys()), [issues])
  const onSelect = useCallback((key: string) => setSelectedKey(key), [setSelectedKey])

  const apiIssues = save.error === null ? [] : errorIssues(save.error)

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

      <StationSheet
        stations={stations}
        selectedKey={selectedKey}
        onSelectKey={setSelectedKey}
        onStations={setStations}
        onAdd={add}
        kind={kind}
        issues={issues}
        skills={skills}
        previewMissing={previewMissing}
        onSetupPreview={onSetupPreview}
      />
    </div>
  )
}
