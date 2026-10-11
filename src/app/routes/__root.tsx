import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { useEffect } from 'react'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { CommandPalette } from '@/app/routes/-components/command-palette'
import {
  useDocumentTitle,
  useNeedsYou,
  useRunningByProject,
} from '@/app/routes/-components/use-needs-you'
import { AppShell } from '@/components/layout/app-shell'
import { ThemeToggle } from '@/components/theme-toggle'
import { Kbd } from '@/components/ui/kbd'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/config/env'
import { NewProjectDialog } from '@/app/routes/-components/new-project-dialog'
import { ProjectNav, useProject } from '@/features/projects/components/project-nav'
import { ProjectPrNav } from '@/app/routes/-components/project-pr-nav'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import { showNotificationToast } from '@/features/notifications/components/notification-toast'
import { notifyInBrowser } from '@/features/notifications/utils/browser-notifications'
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
  const router = useRouter()
  // Notification paths are in-app and may carry a query string (`?view=board&wo=…`).
  const openPath = (path: string) => router.history.push(path)
  useRealtime({
    onNotification: (notification) => {
      showNotificationToast(notification, openPath)
      notifyInBrowser(notification, openPath)
    },
  })
  const { items, countByProject } = useNeedsYou()
  const runningByProject = useRunningByProject()
  const params = useParams({ strict: false })
  const projectId = 'projectId' in params ? params.projectId : undefined
  const project = useProject(projectId ?? '')
  useDocumentTitle(items.length, project?.name)
  return (
    <>
      <AppShell
        projects={
          <ProjectNav
            needsYou={countByProject}
            running={runningByProject}
            renderSub={(id) => <ProjectPrNav projectId={id} />}
          />
        }
        projectActions={<NewProjectDialog />}
        headerActions={<NotificationBell onOpen={openPath} />}
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
