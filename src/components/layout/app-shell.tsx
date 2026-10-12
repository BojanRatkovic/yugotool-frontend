import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'

import { HeaderActionsProvider } from '@/components/layout/header-actions'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      {/* A milling cutter with a Y: tools, as Jugoalat made them. */}
      <path
        className="fill-brand"
        d="M17.19 4.66 L17.57 1.08 L19.67 1.69 Q23.37 3.98 22.7 6.78 L22.7 6.78 L24.82 3.86 L26.34 5.44 Q28.39 9.27 26.41 11.36 L26.41 11.36 L29.7 9.9 L30.23 12.03 Q30.1 16.37 27.34 17.19 L27.34 17.19 L30.92 17.57 L30.31 19.67 Q28.02 23.37 25.22 22.7 L25.22 22.7 L28.14 24.82 L26.56 26.34 Q22.73 28.39 20.64 26.41 L20.64 26.41 L22.1 29.7 L19.97 30.23 Q15.63 30.1 14.81 27.34 L14.81 27.34 L14.43 30.92 L12.33 30.31 Q8.63 28.02 9.3 25.22 L9.3 25.22 L7.18 28.14 L5.66 26.56 Q3.61 22.73 5.59 20.64 L5.59 20.64 L2.3 22.1 L1.77 19.97 Q1.9 15.63 4.66 14.81 L4.66 14.81 L1.08 14.43 L1.69 12.33 Q3.98 8.63 6.78 9.3 L6.78 9.3 L3.86 7.18 L5.44 5.66 Q9.27 3.61 11.36 5.59 L11.36 5.59 L9.9 2.3 L12.03 1.77 Q16.37 1.9 17.19 4.66 Z"
      />
      <circle cx="16" cy="16" r="9.6" fill="#16181d" />
      <path
        d="M11.22 10.48 L16 16.18 L20.78 10.48 M16 16.18 V22.44"
        stroke="#f4f1ea"
        strokeWidth="2.8"
        fill="none"
      />
    </svg>
  )
}

const SIDEBAR_STYLE: CSSProperties & Record<'--sidebar-width', string> = {
  '--sidebar-width': '16rem',
}

/** Sidebar + main area. Feature slots are composed at the app layer. */
export function AppShell({
  projects,
  projectActions,
  footer,
  headerActions,
  children,
}: {
  projects: ReactNode
  /** Small icon action next to the "Projects" label. */
  projectActions: ReactNode
  /** Dispatcher, plan usage, auth and settings — pinned to the bottom. */
  footer?: ReactNode
  /** App-wide actions top-right of the main area; pages place them via `<HeaderActions />`. */
  headerActions?: ReactNode
  children: ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider style={SIDEBAR_STYLE}>
        <Sidebar>
          <SidebarHeader className="h-12 justify-center px-4 py-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 rounded-md"
              aria-label="YugoTool home"
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="text-[0.8125rem] font-semibold tracking-[0.12em]">YugoTool</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <div className="flex items-center justify-between pr-1">
                <SidebarGroupLabel className="label-caps">Projects</SidebarGroupLabel>
                {projectActions}
              </div>
              <SidebarGroupContent>{projects}</SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          {footer === undefined ? null : (
            <SidebarFooter className="gap-2 p-3">{footer}</SidebarFooter>
          )}
        </Sidebar>
        <SidebarInset id="main-content" className="min-w-0">
          <HeaderActionsProvider value={headerActions ?? null}>
            {children}
          </HeaderActionsProvider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
