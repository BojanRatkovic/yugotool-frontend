import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/settings/components/settings-section'
import { KnowledgeLibrary } from '@/features/knowledge/components/knowledge-library'

export const Route = createFileRoute('/settings/knowledge')({
  component: () => (
    <SettingsPage>
      <KnowledgeLibrary />
    </SettingsPage>
  ),
})
