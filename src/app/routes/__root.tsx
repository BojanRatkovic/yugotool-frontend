import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { useEffect } from 'react'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { CommandPalette } from '@/app/routes/-components/command-palette'
import { useDocumentTitle, useNeedsYou } from '@/app/routes/-components/use-needs-you'
import { AppShell } from '@/components/layout/app-shell'
import { ThemeToggle } from '@/components/theme-toggle'
import { Kbd } from '@/components/ui/kbd'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/config/env'
import { NewProjectDialog } from '@/app/routes/-components/new-project-dialog'
import { ProjectNav, useProject } from '@/features/projects/components/project-nav'
import { AuthChip } from '@/features/system/components/auth-chip'
import { DispatcherCard } from '@/features/system/components/dispatcher-card'
import { PlanUsageCard } from '@/features/system/components/plan-usage-card'
import { useRealtime } from '@/lib/realtime'
import { IS_MAC } from '@/lib/shortcuts'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

/** Sidebar link to /settings; `⌘,` opens it from anywhere. */
function SettingsLink() {
  const navigate = useNavigate()
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== ',' || !(event.metaKey || event.ctrlKey) || event.altKey) return
      event.preventDefault()
      void navigate({ to: '/settings' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild className="h-8">
          <Link to="/settings" activeProps={{ 'data-active': true }}>
            <Settings aria-hidden="true" />
            <span className="flex-1">Settings</span>
            <Kbd className="h-4">{IS_MAC ? '⌘,' : 'Ctrl+,'}</Kbd>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function RootLayout() {
  useRealtime()
  const { items, countByProject } = useNeedsYou()
  const params = useParams({ strict: false })
  const projectId = 'projectId' in params ? params.projectId : undefined
  const project = useProject(projectId ?? '')
  useDocumentTitle(items.length, project?.name)
  return (
    <>
      <AppShell
        projects={<ProjectNav needsYou={countByProject} />}
        projectActions={<NewProjectDialog />}
        footer={
          <>
            <SettingsLink />
            <DispatcherCard />
            <PlanUsageCard />
            <div className="flex items-center justify-between">
              <AuthChip />
              <ThemeToggle />
            </div>
          </>
        }
      >
        <Outlet />
        <CommandPalette needsYou={items} />
      </AppShell>
      <Toaster position="bottom-right" />
      {env.DEVTOOLS ? <TanStackRouterDevtools position="bottom-left" /> : null}
    </>
  )
}
