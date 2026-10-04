import { toast } from 'sonner'

import { NotificationKindIcon } from '@/features/notifications/components/notification-kind-icon'
import type { Notification } from '@/lib/contracts'

/** Toasts a notification that just arrived; "Open" goes where the bell item would. */
export function showNotificationToast(
  notification: Notification,
  open: (path: string) => void,
) {
  toast(notification.title, {
    id: notification.id,
    description: notification.body === '' ? undefined : notification.body,
    icon: <NotificationKindIcon kind={notification.kind} />,
    action: { label: 'Open', onClick: () => open(notification.path) },
  })
}
