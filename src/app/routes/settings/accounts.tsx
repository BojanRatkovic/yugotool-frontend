import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { SettingsPage } from '@/features/settings/components/settings-section'
import { ClaudeAccountsSection } from '@/features/claude-accounts/components/claude-accounts-section'
import { systemQueries } from '@/features/system/api/system-queries'

export const Route = createFileRoute('/settings/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  const system = useQuery(systemQueries.info())
  return (
    <SettingsPage>
      <ClaudeAccountsSection system={system.data} />
    </SettingsPage>
  )
}
