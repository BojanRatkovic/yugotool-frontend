import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { StationSheet } from '@/features/projects/components/station-sheet'
import { useLineDraft } from '@/features/projects/hooks/use-line-draft'
import type { Line } from '@/lib/contracts'

function draftStatus(pending: boolean, dirty: boolean, canSave: boolean): string {
  if (pending) return 'Saving…'
  if (!dirty) return 'Saved'
  return canSave ? 'Unsaved changes' : 'Unsaved changes · fix the highlighted fields'
}

/**
 * One station of the line in a sheet, opened from anywhere (the run panel's
 * pipeline). Same editor as the line view; Save PUTs the whole line. Mount
 * with a key per opened station so each open starts from the saved line.
 */
export function StationQuickEdit({
  line,
  stationKey,
  onClose,
  previewMissing,
  onSetupPreview,
}: {
  line: Line
  stationKey: string
  onClose: () => void
  previewMissing: boolean
  onSetupPreview: () => void
}) {
  const draft = useLineDraft(line, 'build', { initialKey: stationKey, onSaved: onClose })
  return (
    <StationSheet
      stations={draft.stations}
      selectedKey={draft.selectedKey}
      onSelectKey={(key) => {
        draft.setSelectedKey(key)
        if (key === null) onClose()
      }}
      onStations={draft.setStations}
      onAdd={draft.add}
      kind="build"
      issues={draft.issues}
      skills={draft.skills}
      previewMissing={previewMissing}
      onSetupPreview={onSetupPreview}
      footer={
        <div className="flex items-center gap-2 border-t pt-2">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {draftStatus(draft.save.isPending, draft.isDirty, draft.canSave)}
          </span>
          <Button
            size="sm"
            className="ml-auto"
            disabled={!draft.canSave || draft.save.isPending}
            onClick={() => void draft.form.handleSubmit()}
          >
            <Save aria-hidden="true" />
            Save line
          </Button>
        </div>
      }
    />
  )
}
