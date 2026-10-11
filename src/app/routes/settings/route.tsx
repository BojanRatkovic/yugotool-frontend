import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'

import {
  SettingsSideNav,
  SettingsTabStrip,
  settingsPageLabel,
} from '@/app/routes/settings/-components/settings-nav'
import { HeaderActions } from '@/components/layout/header-actions'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { settingsQueries } from '@/features/settings/api/settings-queries'
import { systemQueries } from '@/features/system/api/system-queries'

export const Route = createFileRoute('/settings')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(settingsQueries.detail())
    // The nav's Doctor dot reads it on every page.
    void queryClient.prefetchQuery(systemQueries.doctor())
  },
  component: SettingsLayout,
})

/**
 * Settings shell: a page per topic. md and up, a nav column beside the page;
 * below md, a tab strip under the header. Only the page column scrolls, so
 * a form's Save bar can stick to its bottom edge.
 */
function SettingsLayout() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const page = settingsPageLabel(pathname)
  return (
    <div className="flex h-svh min-w-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <SidebarTrigger aria-label="Toggle sidebar" />
        <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <Link to="/settings" className="rounded-sm hover:text-foreground/80">
            Settings
          </Link>
          {page === null ? null : (
            <>
              <ChevronRight aria-hidden="true" className="size-3.5 text-muted-foreground" />
              <span className="truncate font-normal text-muted-foreground">{page}</span>
            </>
          )}
        </h1>
        <HeaderActions className="ml-auto" />
      </header>
      <div className="md:hidden">
        <SettingsTabStrip pathname={pathname} />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r p-3 md:block">
          <SettingsSideNav />
        </aside>
        <div
          data-settings-scroll
          className="relative min-h-0 min-w-0 flex-1 scrollbar-thin overflow-y-auto"
        >
          <Outlet />
        </div>
      </div>
    </div>
  )
}
