import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useLocation } from '@tanstack/react-router'

import {
  SettingsLoadError,
  SettingsSkeleton,
} from '@/app/routes/settings/-components/settings-loading'
import { settingsQueries } from '@/features/settings/api/settings-queries'
import {
  GeneralSettingsForm,
  REPOS_ROOT_FIELD_ID,
} from '@/features/settings/components/general-settings-form'
import { SettingsPage } from '@/features/settings/components/settings-section'
import { GENERAL_KEYS, settingsFormKey } from '@/features/settings/utils/settings-form'
import { systemQueries } from '@/features/system/api/system-queries'

export const Route = createFileRoute('/settings/general')({
  component: GeneralPage,
})

function GeneralPage() {
  const settings = useQuery(settingsQueries.detail())
  const system = useQuery(systemQueries.info())
  // `#settings-repos-root` (from the repo picker): focus the field once it exists.
  const hash = useLocation({ select: (location) => location.hash })
  return (
    <SettingsPage flush={settings.data !== undefined}>
      {settings.isPending ? (
        <SettingsSkeleton sections={[1, 3, 2]} />
      ) : settings.data === undefined ? (
        <SettingsLoadError error={settings.error} />
      ) : (
        <GeneralSettingsForm
          key={settingsFormKey(settings.data, GENERAL_KEYS)}
          settings={settings.data}
          reposRootDefault={system.data?.reposRootDefault}
          focusReposRootField={hash === REPOS_ROOT_FIELD_ID}
        />
      )}
    </SettingsPage>
  )
}
