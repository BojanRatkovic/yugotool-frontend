import { useQuery } from '@tanstack/react-query'
import { Link, type LinkProps } from '@tanstack/react-router'
import {
  Bell,
  Blocks,
  BookOpen,
  type LucideIcon,
  Palette,
  SlidersHorizontal,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

import { systemQueries } from '@/features/system/api/system-queries'
import { notReadyMessage } from '@/features/system/utils/doctor'
import { cn } from '@/lib/utils'

interface NavItem {
  to: NonNullable<LinkProps['to']>
  label: string
  icon: LucideIcon
}

/** Settings pages, in nav order. Every page is its own route (`/settings/<page>`). */
export const SETTINGS_NAV = [
  { to: '/settings/general', label: 'General', icon: SlidersHorizontal },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette },
  { to: '/settings/accounts', label: 'Claude accounts', icon: UserRound },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/settings/integrations', label: 'Integrations', icon: Blocks },
  { to: '/settings/doctor', label: 'Doctor', icon: Stethoscope },
] as const satisfies readonly NavItem[]

/** A red dot on Doctor while a required check fails, so it's findable from any page. */
function useDoctorBlocking() {
  const doctor = useQuery(systemQueries.doctor())
  return doctor.data !== undefined && notReadyMessage(doctor.data) !== null
}

function Dot({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-full bg-status-failed', className)}
      />
      <span className="sr-only">(a required check fails)</span>
    </>
  )
}

/** md and up: a vertical list beside the page, like Linear or Vercel settings. */
export function SettingsSideNav() {
  const blocking = useDoctorBlocking()
  return (
    <nav aria-label="Settings" className="flex flex-col gap-0.5">
      {SETTINGS_NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeProps={{ 'aria-current': 'page' }}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[0.8125rem] text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            'aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground',
          )}
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
          {blocking && to === '/settings/doctor' ? <Dot className="ml-auto" /> : null}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Below md: the same pages as a horizontally scrolling tab strip under the
 * header. The active tab scrolls into view, so deep links land visibly.
 */
export function SettingsTabStrip({ pathname }: { pathname: string }) {
  const blocking = useDoctorBlocking()
  const strip = useRef<HTMLElement>(null)
  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>(`a[href="${pathname}"]`)
    active?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  return (
    <nav
      ref={strip}
      aria-label="Settings"
      className="flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-b px-3 [&::-webkit-scrollbar]:hidden"
    >
      {SETTINGS_NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          activeProps={{ 'aria-current': 'page' }}
          className={cn(
            'relative flex h-10 shrink-0 items-center gap-2 px-2 text-[0.8125rem] whitespace-nowrap text-muted-foreground transition-colors',
            'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
            'aria-[current=page]:text-foreground',
            "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:content-[''] aria-[current=page]:after:opacity-100",
          )}
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {label}
          {blocking && to === '/settings/doctor' ? <Dot /> : null}
        </Link>
      ))}
    </nav>
  )
}

/** The page's nav label, for the header breadcrumb. */
export function settingsPageLabel(pathname: string): string | null {
  return SETTINGS_NAV.find(({ to }) => pathname.startsWith(to))?.label ?? null
}
