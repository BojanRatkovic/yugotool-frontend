import type {
  PostFindings,
  PreviousFinding,
  PreviousStatus,
  ReviewFinding,
  YugoToolReview,
  YugoToolReviewBrief,
} from '@/lib/contracts'

/** What the PR's YugoTool review looks like at a glance (header button and card chip). */
export type YugoToolState =
  | { kind: 'none' }
  | { kind: 'running' }
  | { kind: 'failed' }
  | {
      kind: 'done'
      findings: number
      open: number
      stale: boolean
      /** The head moved after a review with findings: time to check they were fixed. */
      reReview: boolean
    }

export function yugotoolState(
  review: Pick<YugoToolReview, 'status'> & {
    findings: number | null
    posted: number
    stale: boolean
  },
): YugoToolState {
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
        reReview: review.stale && findings > 0,
      }
    }
    case 'failed':
      return { kind: 'failed' }
    default:
      // Cancelled or rejected: nothing to show, start again.
      return { kind: 'none' }
  }
}

export function fromReview(review: YugoToolReview | null): YugoToolState {
  if (review === null) return { kind: 'none' }
  return yugotoolState({
    status: review.status,
    findings: review.verdict?.findings.length ?? null,
    posted: review.pullRequest.posted.length,
    stale: review.stale,
  })
}

/** A card's chip: stale when the PR's head moved past the reviewed commit. */
export function fromBrief(
  brief: YugoToolReviewBrief | undefined,
  headOid: string,
): YugoToolState {
  if (brief === undefined) return { kind: 'none' }
  return yugotoolState({ ...brief, stale: brief.headOid !== headOid })
}

export function findingsLabel(state: Extract<YugoToolState, { kind: 'done' }>): string {
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

/** A previous finding with what the re-review said about it (spec 0010). */
export interface PreviousRow {
  finding: PreviousFinding
  /** `unchecked`: the reviewer gave it no status. */
  status: PreviousStatus['status'] | 'unchecked'
  note: string
}

export function previousRows(
  findings: PreviousFinding[],
  statuses: PreviousStatus[],
): PreviousRow[] {
  const byId = new Map(statuses.map((s) => [s.id, s]))
  return findings.map((finding) => {
    const status = byId.get(finding.id)
    return status === undefined
      ? { finding, status: 'unchecked', note: '' }
      : { finding, status: status.status, note: status.note }
  })
}

const COUNT_LABEL: Record<PreviousRow['status'], string> = {
  fixed: 'fixed',
  partly: 'partly',
  open: 'still open',
  unchecked: 'not checked',
}

/** "2 fixed · 1 partly · 1 still open", skipping the empty ones. */
export function previousCounts(rows: PreviousRow[]): string {
  return (['fixed', 'partly', 'open', 'unchecked'] as const)
    .map((status) => [rows.filter((r) => r.status === status).length, status] as const)
    .filter(([n]) => n > 0)
    .map(([n, status]) => `${n} ${COUNT_LABEL[status]}`)
    .join(' · ')
}

/** What a resolved thread says first, so the author sees where it was fixed. */
export function fixedReply(headOid: string): string {
  return `Fixed in ${headOid.slice(0, 7)}.`
}

/** The prefilled "still open" reply: the re-review's evidence. */
export function stillOpenReply(row: PreviousRow): string {
  const lead = row.status === 'partly' ? 'Partly fixed' : 'Still open'
  return row.note.trim() === '' ? `${lead}.` : `${lead}: ${row.note.trim()}`
}
