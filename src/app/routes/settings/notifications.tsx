import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import {
  SettingsLoadError,
  SettingsSkeleton,
} from '@/app/routes/settings/-components/settings-loading'
import { NotificationKindIcon } from '@/features/notifications/components/notification-kind-icon'
import { settingsQueries } from '@/features/settings/api/settings-queries'
import { NotificationChannelsForm } from '@/features/settings/components/notification-channels-form'
import { NotificationKindsSection } from '@/features/settings/components/notification-kinds-section'
import { SettingsPage } from '@/features/settings/components/settings-section'
import { CHANNEL_KEYS, settingsFormKey } from '@/features/settings/utils/settings-form'
import type { NotificationKind } from '@/lib/contracts'

export const Route = createFileRoute('/settings/notifications')({
  component: NotificationsPage,
})

const kindIcon = (kind: NotificationKind) => <NotificationKindIcon kind={kind} />

function NotificationsPage() {
  const settings = useQuery(settingsQueries.detail())
  return (
    <SettingsPage flush={settings.data !== undefined}>
      {settings.isPending ? (
        <SettingsSkeleton sections={[5, 6]} />
      ) : settings.data === undefined ? (
        <SettingsLoadError error={settings.error} />
      ) : (
        <NotificationChannelsForm
          key={settingsFormKey(settings.data, CHANNEL_KEYS)}
          settings={settings.data}
        >
          <NotificationKindsSection settings={settings.data} icon={kindIcon} />
        </NotificationChannelsForm>
      )}
    </SettingsPage>
  )
}
