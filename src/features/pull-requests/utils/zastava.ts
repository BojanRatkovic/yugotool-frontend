import type { ZastavaReview, ZastavaReviewBrief } from '@/lib/contracts'

/** What the PR's ZASTAVA review looks like at a glance (header button and card chip). */
export type ZastavaState =
  | { kind: 'none' }
  | { kind: 'running' }
  | { kind: 'failed' }
  | { kind: 'done'; findings: number; open: number; stale: boolean }

export function zastavaState(
  review: Pick<ZastavaReview, 'status'> & {
    findings: number | null
    posted: number
    stale: boolean
  },
): ZastavaState {
  switch (review.status) {
    case 'running':
    case 'awaiting_approval':
      return { kind: 'running' }
    case 'succeeded': {
      const findings = review.findings ?? 0
      return {
        kind: 'done',
        findings,
        open: Math.max(0, findings - review.posted),
        stale: review.stale,
      }
    }
    case 'failed':
      return { kind: 'failed' }
    default:
      // Cancelled or rejected: nothing to show, start again.
      return { kind: 'none' }
  }
}

export function fromReview(review: ZastavaReview | null): ZastavaState {
  if (review === null) return { kind: 'none' }
  return zastavaState({
    status: review.status,
    findings: review.verdict?.findings.length ?? null,
    posted: review.pullRequest.posted.length,
    stale: review.stale,
  })
}

/** A card's chip: stale when the PR's head moved past the reviewed commit. */
export function fromBrief(
  brief: ZastavaReviewBrief | undefined,
  headOid: string,
): ZastavaState {
  if (brief === undefined) return { kind: 'none' }
  return zastavaState({ ...brief, stale: brief.headOid !== headOid })
}

export function findingsLabel(state: Extract<ZastavaState, { kind: 'done' }>): string {
  if (state.findings === 0) return 'No findings'
  if (state.open === 0) return `${state.findings} posted`
  return `${state.open} finding${state.open === 1 ? '' : 's'}`
}
