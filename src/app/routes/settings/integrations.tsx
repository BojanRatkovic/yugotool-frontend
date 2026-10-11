import { createFileRoute } from '@tanstack/react-router'

import { ProductiveCard } from '@/features/integrations/components/productive-card'
import { productiveQueries } from '@/features/integrations/api/productive-queries'
import { SettingsPage } from '@/features/settings/components/settings-section'

export const Route = createFileRoute('/settings/integrations')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(productiveQueries.status())
  },
  component: IntegrationsPage,
})

function IntegrationsPage() {
  return (
    <SettingsPage>
      <section aria-labelledby="integrations-heading" className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <h2 id="integrations-heading" className="text-sm font-semibold">
            Integrations
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">
            Bring work in from the tools your team plans in.
          </p>
        </div>
        <ProductiveCard />
      </section>
    </SettingsPage>
  )
}
