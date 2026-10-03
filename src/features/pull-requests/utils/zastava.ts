import type {
  PostFindings,
  ReviewFinding,
  ZastavaReview,
  ZastavaReviewBrief,
} from '@/lib/contracts'

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

export interface FindingEdit {
  title: string
  body: string
  suggestion: string | null
}

/** Critical and important findings start picked; minor ones and posted ones don't. */
export function defaultSelection(findings: ReviewFinding[], posted: string[]): Set<string> {
  return new Set(
    findings.filter((f) => f.severity !== 'minor' && !posted.includes(f.id)).map((f) => f.id),
  )
}

/** The picked, not yet posted findings, with the human's edits, in the review's order. */
export function postPayload(
  findings: ReviewFinding[],
  selected: Set<string>,
  posted: string[],
  edits: Record<string, FindingEdit>,
): PostFindings {
  return {
    findings: findings
      .filter((f) => selected.has(f.id) && !posted.includes(f.id))
      .map((f) => {
        const edit = edits[f.id]
        return {
          id: f.id,
          title: (edit?.title ?? f.title).trim() || f.title,
          body: edit?.body ?? f.body,
          suggestion: edit === undefined ? f.suggestion : edit.suggestion,
        }
      }),
  }
}

/** Where a finding points, as the row shows it. */
export function findingPlace(
  f: Pick<ReviewFinding, 'file' | 'line' | 'startLine'>,
): string | null {
  if (f.file === null) return null
  if (f.line === null) return f.file
  return f.startLine === null ? `${f.file}:${f.line}` : `${f.file}:${f.startLine}–${f.line}`
}
