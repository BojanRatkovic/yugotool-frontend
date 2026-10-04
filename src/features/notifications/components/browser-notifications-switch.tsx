import { useState } from 'react'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  browserPermission,
  readOptIn,
  writeOptIn,
  type BrowserPermission,
} from '@/features/notifications/utils/browser-notifications'

/**
 * Bell footer: also show new notifications as browser notifications while
 * the tab is in the background. Hidden where unsupported (and in the desktop
 * app, which shows native ones).
 */
export function BrowserNotificationsSwitch() {
  const [permission, setPermission] = useState<BrowserPermission>(() => browserPermission())
  const [optedIn, setOptedIn] = useState(readOptIn)
  if (permission === 'unsupported') return null

  const toggle = async (on: boolean) => {
    if (on && permission !== 'granted') {
      const answer = await window.Notification.requestPermission()
      setPermission(answer)
      if (answer !== 'granted') return
    }
    writeOptIn(on)
    setOptedIn(on)
  }

  const blocked = permission === 'denied'
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <Label htmlFor="bell-browser-notifications" className="text-xs">
          Alert me when this tab is in the background
        </Label>
        {blocked ? (
          <p className="text-[0.6875rem] text-muted-foreground">
            Blocked by the browser. Allow notifications for this site to turn it on.
          </p>
        ) : null}
      </div>
      <Switch
        id="bell-browser-notifications"
        size="sm"
        disabled={blocked}
        checked={optedIn && permission === 'granted'}
        onCheckedChange={(on) => void toggle(on)}
      />
    </div>
  )
}
