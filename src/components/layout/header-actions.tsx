import { createContext, type ReactNode, useContext } from 'react'

import { cn } from '@/lib/utils'

const HeaderActionsContext = createContext<ReactNode>(null)

export const HeaderActionsProvider = HeaderActionsContext.Provider

/**
 * App-wide actions (the notification bell) that the shell hands to every page.
 * Each page header renders this as its last, right-most item, so the actions
 * sit top-right of the main area without a second bar above the page header.
 */
export function HeaderActions({ className }: { className?: string }) {
  const actions = useContext(HeaderActionsContext)
  if (actions === null || actions === undefined) return null
  return <div className={cn('flex shrink-0 items-center', className)}>{actions}</div>
}
