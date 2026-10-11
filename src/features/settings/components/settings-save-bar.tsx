import { Save, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { errorIssues, errorMessage } from '@/lib/api-client'

/**
 * A settings form's last child: sticky to the bottom of the settings scroll
 * column, full content width. At the end of the page it sits below the last
 * section instead of covering it.
 */
export function SettingsSaveBar({
  pending,
  error,
  dirty,
  canSubmit,
  onDiscard,
  label = 'Save settings',
}: {
  pending: boolean
  /** The save's error, shown above the buttons; null when shown elsewhere (under a field). */
  error: Error | null
  dirty: boolean
  canSubmit: boolean
  onDiscard: () => void
  label?: string
}) {
  const issues = error === null ? [] : errorIssues(error)
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
      {error === null ? null : (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive">{errorMessage(error)}</p>
          {issues.length === 0 ? null : (
            <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="mr-auto min-w-0 text-xs text-muted-foreground" aria-live="polite">
          {pending
            ? 'Saving…'
            : dirty
              ? canSubmit
                ? 'Unsaved changes'
                : 'Unsaved changes — fix the highlighted fields'
              : 'Saved'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!dirty || pending}
          onClick={onDiscard}
        >
          <Undo2 aria-hidden="true" />
          Discard
        </Button>
        <Button type="submit" size="sm" disabled={!dirty || !canSubmit || pending}>
          <Save aria-hidden="true" />
          {label}
        </Button>
      </div>
    </div>
  )
}
