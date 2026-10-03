import { Link } from '@tanstack/react-router'
import type { CSSProperties, ReactNode } from 'react'

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

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="7" className="fill-brand" />
      <path
        d="M10 7v18M10 8h13l-3.5 4.5L23 17H10"
        className="stroke-white"
        strokeWidth="2.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SIDEBAR_STYLE: CSSProperties & Record<'--sidebar-width', string> = {
  '--sidebar-width': '15rem',
}

/** Sidebar + main area. Feature slots are composed at the app layer. */
export function AppShell({
  projects,
  projectActions,
  footer,
  children,
}: {
  projects: ReactNode
  /** Small icon action next to the "Projects" label. */
  projectActions: ReactNode
  /** Plan usage, auth, settings — pinned to the bottom. */
  footer?: ReactNode
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
              aria-label="ZASTAVA home"
            >
              <BrandMark className="size-5 shrink-0" />
              <span className="text-[0.8125rem] font-semibold tracking-[0.12em]">ZASTAVA</span>
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
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
