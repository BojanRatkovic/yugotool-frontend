import { desktopBridge } from '@/lib/desktop'
import type { Notification } from '@/lib/contracts'

const STORAGE_KEY = 'yugotool:browser-notifications'

export type BrowserPermission = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * The browser's permission, or `unsupported` where a browser notification
 * makes no sense: no API, or inside the desktop app (it shows native ones).
 */
export function browserPermission(
  target: { Notification?: { permission: NotificationPermission } } = window,
): BrowserPermission {
  if (desktopBridge() !== null || target.Notification === undefined) return 'unsupported'
  return target.Notification.permission
}

/** The opt-in is per browser: a viewer convenience, so storage failures read as off. */
export function readOptIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function writeOptIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode or blocked storage: the switch just won't stick.
  }
}

/** Only when you are not looking at the tab: in view, the toast already says it. */
export function shouldNotify(state: {
  optedIn: boolean
  permission: BrowserPermission
  hidden: boolean
}): boolean {
  return state.optedIn && state.permission === 'granted' && state.hidden
}

/** Shows `notification` as a browser notification when the rules allow; click opens its page. */
export function notifyInBrowser(
  notification: Notification,
  open: (path: string) => void,
): void {
  const permission = browserPermission()
  if (!shouldNotify({ optedIn: readOptIn(), permission, hidden: document.hidden })) return
  const shown = new window.Notification(notification.title, {
    body: notification.body,
    // Same id twice (a reconnect replay) replaces instead of stacking.
    tag: notification.id,
  })
  shown.addEventListener('click', () => {
    window.focus()
    open(notification.path)
    shown.close()
  })
}
