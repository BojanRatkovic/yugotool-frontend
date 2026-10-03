import { createRouter } from '@tanstack/react-router'

import { routeTree } from '@/app/routeTree.gen'
import { queryClient } from '@/lib/query-client'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Query owns freshness — always revalidate loader data through it.
  defaultPreloadStaleTime: 0,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
