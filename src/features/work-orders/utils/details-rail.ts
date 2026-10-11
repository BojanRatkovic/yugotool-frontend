/** One preference for every work order in this browser: is the details rail shown? */
export const DETAILS_RAIL_KEY = 'yugotool:wo-details-open'

/** Open unless it was hidden here; storage errors mean open. */
export function readDetailsRailOpen(): boolean {
  try {
    return window.localStorage.getItem(DETAILS_RAIL_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeDetailsRailOpen(open: boolean): void {
  try {
    window.localStorage.setItem(DETAILS_RAIL_KEY, open ? '1' : '0')
  } catch {
    // Private mode or blocked storage: the choice lasts until the page reloads.
  }
}

/** `]` toggles the rail. Option (macOS) or AltGr (Windows) may be needed to type it; ⌘/Ctrl alone mean another shortcut. */
export function isDetailsRailKey(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>,
): boolean {
  if (event.key !== ']' || event.metaKey) return false
  return !event.ctrlKey || event.altKey
}
