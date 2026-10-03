import type { DoctorCheck, DoctorReport } from '@/lib/contracts'

/** Required checks that fail: these stop runs. */
export function blockingChecks(report: DoctorReport): DoctorCheck[] {
  return report.checks.filter((check) => check.required && check.status === 'fail')
}

/** "Claude", "Claude and Worker", "Claude, git and Worker". */
export function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1) ?? ''}`
}

/** The banner sentence for Home, or null when every required check passes. */
export function notReadyMessage(report: DoctorReport): string | null {
  if (report.ready) return null
  const labels = blockingChecks(report).map((check) => check.label)
  return labels.length === 0
    ? 'ZASTAVA can’t run work yet.'
    : `ZASTAVA can’t run work yet: ${joinLabels(labels)}.`
}
