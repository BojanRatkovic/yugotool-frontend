import { createFileRoute, redirect } from '@tanstack/react-router'

import { DOCTOR_ANCHOR } from '@/features/system/components/doctor-section'
import { REPOS_ROOT_FIELD_ID } from '@/features/settings/components/general-settings-form'

/**
 * `/settings` opens General. Links from before settings had pages (spec 0019)
 * carried a hash into the one long page; send each to its page.
 */
export const Route = createFileRoute('/settings/')({
  beforeLoad: ({ location }) => {
    if (location.hash === DOCTOR_ANCHOR)
      throw redirect({ to: '/settings/doctor', replace: true })
    if (location.hash === 'knowledge-heading') {
      throw redirect({ to: '/settings/knowledge', replace: true })
    }
    throw redirect({
      to: '/settings/general',
      hash: location.hash === REPOS_ROOT_FIELD_ID ? REPOS_ROOT_FIELD_ID : undefined,
      replace: true,
    })
  },
})
