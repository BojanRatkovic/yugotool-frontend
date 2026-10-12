// Pure: how the project page's URL search follows the work order panel.
import type { PanelState } from '@/app/routes/-components/work-order-panel'
import type { Project } from '@/lib/contracts'

/** The search keys a panel change sets; picking another run resets what lives inside a run. */
export function panelSearchPatch(next: Partial<PanelState>) {
  return {
    ...('tab' in next ? { woTab: next.tab === 'activity' ? undefined : next.tab } : {}),
    ...('station' in next ? { station: next.station } : {}),
    ...('run' in next
      ? { run: next.run, shift: undefined, qaAttempt: undefined, qaCheck: undefined }
      : {}),
    ...('qaAttempt' in next ? { qaAttempt: next.qaAttempt } : {}),
    ...('qaCheck' in next ? { qaCheck: next.qaCheck } : {}),
    ...('shift' in next ? { shift: next.shift } : {}),
    ...('full' in next ? { woFull: next.full === true ? true : undefined } : {}),
  }
}

/** No preview to QA against: a repo without one, or a hub where no repo has one. Unknown = false. */
export function previewMissing(project: Project | undefined): boolean {
  if (project === undefined) return false
  return project.kind === 'hub'
    ? project.repos.every((repo) => repo.preview === null)
    : project.preview === null
}
