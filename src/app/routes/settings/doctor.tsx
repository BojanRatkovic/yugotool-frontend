import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/settings/components/settings-section'
import { DoctorSection } from '@/features/system/components/doctor-section'

export const Route = createFileRoute('/settings/doctor')({
  component: () => (
    <SettingsPage>
      <DoctorSection />
    </SettingsPage>
  ),
})
