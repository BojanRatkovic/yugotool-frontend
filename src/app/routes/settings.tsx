import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

import { LoadError } from '@/components/data-state'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { settingsQueries } from '@/features/settings/api/settings-queries'
import { ClaudeAccessSection } from '@/features/settings/components/claude-access-section'
import { REPOS_ROOT_FIELD_ID, SettingsForm } from '@/features/settings/components/settings-form'
import { systemQueries } from '@/features/system/api/system-queries'
import { settingsFormKey } from '@/features/settings/utils/settings-form'
import { DoctorSection } from '@/features/system/components/doctor-section'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/settings')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(settingsQueries.detail())
    void queryClient.prefetchQuery(systemQueries.doctor())
  },
  component: SettingsPage,
})

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      {[3, 2, 5].map((rows, section) => (
        <div key={section} className="flex flex-col gap-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-80" />
          <div className="divide-y rounded-lg border">
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center justify-between px-4 py-3">
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

/** Scrolls to the Repos folder field and focuses it. */
function focusReposRoot() {
  const input = document.getElementById(REPOS_ROOT_FIELD_ID)
  if (!(input instanceof HTMLInputElement)) return
  // Scroll only the settings column: scrollIntoView would also nudge the page shell.
  const column = input.closest('[data-settings-scroll]')
  if (column !== null) {
    const offset = input.getBoundingClientRect().top - column.getBoundingClientRect().top
    column.scrollTo({
      top: column.scrollTop + offset - column.clientHeight / 3,
      behavior: 'smooth',
    })
  }
  input.focus({ preventScroll: true })
}

function SettingsPage() {
  const settings = useQuery(settingsQueries.detail())
  const system = useQuery(systemQueries.info())
  const hash = useLocation({ select: (location) => location.hash })
  const loaded = settings.data !== undefined
  // `#settings-repos-root` (from the repo picker): the field exists once settings load.
  useEffect(() => {
    if (loaded && hash === REPOS_ROOT_FIELD_ID) focusReposRoot()
  }, [loaded, hash])
  return (
    <div className="flex h-svh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>
      <div
        data-settings-scroll
        className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto"
      >
        {/* The form ends in a sticky Save bar that must sit flush with the bottom edge,
            so bottom padding only applies while the form isn't shown. */}
        <div
          className={cn(
            'mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 pt-6',
            settings.data === undefined && 'pb-12',
          )}
        >
          <DoctorSection onFixRepos={focusReposRoot} />
          {settings.isPending ? (
            <SettingsSkeleton />
          ) : settings.data === undefined ? (
            <div>
              <LoadError
                what="settings"
                message={
                  settings.error?.message ?? 'The API returned no settings. Try again shortly.'
                }
              />
            </div>
          ) : (
            <>
              <ClaudeAccessSection settings={settings.data} />
              <SettingsForm
                key={settingsFormKey(settings.data)}
                settings={settings.data}
                reposRootDefault={system.data?.reposRootDefault}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
