import { LoadError } from '@/components/data-state'
import { Skeleton } from '@/components/ui/skeleton'

/** Rows shaped like the settings form while it loads. */
export function SettingsSkeleton({ sections = [3, 2] }: { sections?: number[] }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      {sections.map((rows, section) => (
        <div key={section} className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-full max-w-80" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SettingsLoadError({ error }: { error: Error | null }) {
  return (
    <LoadError
      what="settings"
      message={error?.message ?? 'The API returned no settings. Try again shortly.'}
    />
  )
}
