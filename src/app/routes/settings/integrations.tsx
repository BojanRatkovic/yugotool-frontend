import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/settings/components/settings-section'

export const Route = createFileRoute('/settings/integrations')({
  component: () => <SettingsPage>{null}</SettingsPage>,
})
