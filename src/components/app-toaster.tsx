import type { ComponentProps } from 'react'

import { Toaster } from '@/components/ui/sonner'

/**
 * The app's single toaster, clickable above modal layers. A Radix modal
 * (the work order Sheet, dialogs) sets `pointer-events: none` on <body>, which
 * the toaster inherits — so toast actions like "Open PR" never got the click.
 * `pointer-events: auto` here restores them, and stopping pointerdown at this
 * wrapper keeps Radix from reading the press as "outside" and closing the
 * modal underneath (its listener sits on document, above the React root).
 */
export function AppToaster(props: ComponentProps<typeof Toaster>) {
  return (
    <div
      data-app-toaster=""
      className="pointer-events-auto contents"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Toaster {...props} />
    </div>
  )
}
