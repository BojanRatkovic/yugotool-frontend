import { useQuery } from '@tanstack/react-query'
import { ScanEye } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { lineQueries, useSaveLine } from '@/features/projects/api/line-queries'
import { previewQueries } from '@/features/projects/api/preview-queries'
import {
  dismissQaOffer,
  isQaOfferDismissed,
  qaOffer,
  shouldOfferQa,
} from '@/features/projects/utils/offer-qa'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// "Not now" in one place (settings sheet) hides the other (board) right away.
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function dismiss(projectId: string) {
  dismissQaOffer(projectId)
  for (const listener of listeners) listener()
}

/**
 * "Preview works. Add a QA station to the line?" — shown once the preview's
 * last test passed and the line has no QA (and has a station that edits code).
 * `inline` sits under the Test preview result; `floating` overlays the board's
 * corner so it never moves the columns.
 */
export function OfferQaCallout({
  projectId,
  variant,
}: {
  projectId: string
  variant: 'inline' | 'floating'
}) {
  const line = useQuery(lineQueries.detail(projectId))
  const status = useQuery(previewQueries.status(projectId))
  const save = useSaveLine(projectId)
  const dismissed = useSyncExternalStore(subscribe, () => isQaOfferDismissed(projectId))

  const stations = line.data?.stations
  const visible = shouldOfferQa({
    previewOk: status.data?.last?.ok === true,
    stations,
    dismissed,
  })
  const offer = stations === undefined ? null : qaOffer(stations)
  if (!visible || offer === null) return null

  function add() {
    if (offer === null) return
    save.mutate(
      { stations: offer.stations },
      {
        onSuccess: () => toast.success(`QA station added after ${offer.after}.`),
        onError: (error) => toast.error(`Couldn't add the QA station: ${errorMessage(error)}`),
      },
    )
  }

  return (
    <aside
      aria-label="Add a QA station"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-left',
        variant === 'floating'
          ? 'absolute right-4 bottom-4 z-10 w-[22rem] bg-popover shadow-lg shadow-black/20'
          : 'bg-card',
      )}
    >
      <ScanEye aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <p className="text-[0.8125rem] font-medium">
            Preview works. Add a QA station to the line?
          </p>
          <p className="text-xs text-muted-foreground">
            QA boots the app on each work order&rsquo;s branch, compares it with the base branch
            and reports what broke. It goes after {offer.after}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={save.isPending} onClick={add}>
            {save.isPending ? 'Adding…' : 'Add QA station'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={() => dismiss(projectId)}
          >
            Not now
          </Button>
        </div>
      </div>
    </aside>
  )
}
