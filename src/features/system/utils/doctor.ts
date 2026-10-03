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

/**
 * The one-line summary of the collapsed Doctor and whether it starts open:
 * open only when something blocks runs; optional gaps are named but folded.
 */
export function doctorSummary(report: DoctorReport): {
  tone: 'ok' | 'warn' | 'fail'
  text: string
  openByDefault: boolean
} {
  const total = report.checks.length
  const blocking = blockingChecks(report)
  if (blocking.length > 0) {
    return {
      tone: 'fail',
      text: `${joinLabels(blocking.map((check) => check.label))} ${blocking.length === 1 ? 'blocks' : 'block'} runs`,
      openByDefault: true,
    }
  }
  const limited = report.checks.filter((check) => check.status !== 'ok')
  if (limited.length > 0) {
    return {
      tone: 'warn',
      text: `${total - limited.length} of ${total} OK · limited: ${joinLabels(limited.map((check) => check.label))}`,
      openByDefault: false,
    }
  }
  return { tone: 'ok', text: `All ${total} checks pass`, openByDefault: false }
}
