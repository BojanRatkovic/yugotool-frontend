import { useSyncExternalStore } from 'react'

import {
  DETAILS_RAIL_KEY,
  readDetailsRailOpen,
  writeDetailsRailOpen,
} from '@/features/work-orders/utils/details-rail'

// Held in memory too, so the toggle still works when storage is blocked.
let open: boolean | undefined
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key !== DETAILS_RAIL_KEY) return
  open = readDetailsRailOpen()
  notify()
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): boolean {
  open ??= readDetailsRailOpen()
  return open
}

function setDetailsRailOpen(next: boolean): void {
  open = next
  writeDetailsRailOpen(next)
  notify()
}

export function toggleDetailsRail(): void {
  setDetailsRailOpen(!getSnapshot())
}

/** Whether the work order's details rail is shown; the panel and the command palette share it. */
export function useDetailsRailOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
