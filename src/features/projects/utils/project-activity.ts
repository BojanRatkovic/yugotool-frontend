export type ProjectActivityState = 'running' | 'waiting' | 'idle'

export interface ProjectActivity {
  /** Running wins: work in flight matters more at a glance than a gate (the pill counts those). */
  state: ProjectActivityState
  /** Screen-reader and tooltip text, e.g. "2 running, 1 waiting for approval"; null when idle. */
  label: string | null
}

/** What a sidebar project row shows in place of its dot, from its running and waiting counts. */
export function projectActivity(running: number, waiting: number): ProjectActivity {
  const parts = [
    running > 0 ? `${running} running` : null,
    waiting > 0 ? `${waiting} waiting for approval` : null,
  ].filter((part) => part !== null)
  return {
    state: running > 0 ? 'running' : waiting > 0 ? 'waiting' : 'idle',
    label: parts.length === 0 ? null : parts.join(', '),
  }
}

/** Counts items per project id, e.g. running work orders per project. */
export function countByProject(items: readonly { projectId: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { projectId } of items) counts.set(projectId, (counts.get(projectId) ?? 0) + 1)
  return counts
}
