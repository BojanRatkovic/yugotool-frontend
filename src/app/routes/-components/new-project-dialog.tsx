import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog'
import { systemQueries } from '@/features/system/api/system-queries'

/** The new-project dialog, told which folder the repo picker scans (Settings → Repos folder). */
export function NewProjectDialog(props: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const system = useQuery(systemQueries.info())
  const navigate = useNavigate()
  return (
    <CreateProjectDialog
      {...props}
      reposRoot={system.data?.reposRoot}
      onOpenSettings={() =>
        void navigate({
          to: '/settings/general',
          hash: 'settings-repos-root',
          // The settings page scrolls its own column to the field.
          hashScrollIntoView: false,
        })
      }
    />
  )
}
