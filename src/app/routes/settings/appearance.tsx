import { createFileRoute } from '@tanstack/react-router'

import { ThemePicker } from '@/components/theme-picker'
import { Row, Section, SettingsPage } from '@/features/settings/components/settings-section'

export const Route = createFileRoute('/settings/appearance')({
  component: AppearancePage,
})

function AppearancePage() {
  return (
    <SettingsPage>
      <Section title="Theme" description="Saved in this browser, not on the server.">
        <Row
          id="settings-theme"
          label="Color theme"
          help="Auto follows your system's light or dark setting."
        >
          <ThemePicker id="settings-theme" />
        </Row>
      </Section>
    </SettingsPage>
  )
}
