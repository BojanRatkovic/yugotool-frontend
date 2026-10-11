const openKey = (projectId: string) => `yugotool.prNav.open.${projectId}`

/**
 * Whether a project's pull request boards are expanded in the sidebar,
 * remembered per project in this browser. Collapsed by default; storage
 * errors mean collapsed.
 */
export function isPrNavOpen(projectId: string): boolean {
  try {
    return window.localStorage.getItem(openKey(projectId)) === '1'
  } catch {
    return false
  }
}

export function savePrNavOpen(projectId: string, open: boolean): void {
  try {
    if (open) window.localStorage.setItem(openKey(projectId), '1')
    else window.localStorage.removeItem(openKey(projectId))
  } catch {
    // Private mode or blocked storage: it starts collapsed next visit.
  }
}
