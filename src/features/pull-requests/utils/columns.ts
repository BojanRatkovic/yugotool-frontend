import type { PrReviewer, PrScope, PullRequestSummary } from '@/lib/contracts'

/**
 * Board columns answer one question: whose move is it? Each PR lands in the
 * first column whose rule matches (spec 0008 §3) with a one-line reason.
 */

export type MineColumnKey = 'draft' | 'needs_work' | 'ready' | 'in_review' | 'done'
export type AssignedColumnKey =
  | 'to_review'
  | 're_review'
  | 'waiting_author'
  | 'approved'
  | 'done'
export type PrColumnKey = MineColumnKey | AssignedColumnKey

/** How the reason line reads: a failure, something waiting on you, or plain. */
export type ReasonTone = 'failed' | 'waiting' | 'muted'

export interface PrPlacement {
  column: PrColumnKey
  reason: string
  tone: ReasonTone
}

export interface PrColumnDef {
  key: PrColumnKey
  title: string
  /** The rule, for the column header's tooltip. */
  hint: string
  needsYou: boolean
  empty: string
}

const MINE_COLUMNS: readonly PrColumnDef[] = [
  {
    key: 'draft',
    title: 'Draft',
    hint: 'Open drafts. Mark one ready for review when it is.',
    needsYou: false,
    empty: 'No drafts',
  },
  {
    key: 'needs_work',
    title: 'Needs work',
    hint: 'Changes requested, CI failing, a merge conflict, or a thread waiting on your answer.',
    needsYou: true,
    empty: 'Nothing waiting on you',
  },
  {
    key: 'ready',
    title: 'Ready to merge',
    hint: 'Approved, CI green (or no CI) and no conflict.',
    needsYou: false,
    empty: 'Nothing ready yet',
  },
  {
    key: 'in_review',
    title: 'In review',
    hint: 'Waiting on reviewers or CI.',
    needsYou: false,
    empty: 'Nothing in review',
  },
  {
    key: 'done',
    title: 'Done',
    hint: 'Merged or closed in the last 14 days.',
    needsYou: false,
    empty: 'Nothing merged lately',
  },
]

const ASSIGNED_COLUMNS: readonly PrColumnDef[] = [
  {
    key: 'to_review',
    title: 'To review',
    hint: "Requested from you (or your team), or assigned, and you haven't reviewed it yet.",
    needsYou: true,
    empty: 'Nothing waiting on you',
  },
  {
    key: 're_review',
    title: 'Re-review',
    hint: 'You reviewed it before and you are requested again, new commits answer your requested changes, or your approval was dismissed.',
    needsYou: true,
    empty: 'Nothing waiting on you',
  },
  {
    key: 'waiting_author',
    title: 'Waiting on author',
    hint: 'You requested changes or commented and nothing new came since, or it is a draft.',
    needsYou: false,
    empty: 'Nothing waiting on authors',
  },
  {
    key: 'approved',
    title: 'Approved',
    hint: 'Your approval stands.',
    needsYou: false,
    empty: 'Nothing approved',
  },
  {
    key: 'done',
    title: 'Done',
    hint: 'Merged or closed in the last 14 days.',
    needsYou: false,
    empty: 'Nothing merged lately',
  },
]

function columnsFor(scope: PrScope): readonly PrColumnDef[] {
  return scope === 'mine' ? MINE_COLUMNS : ASSIGNED_COLUMNS
}

/** Compact age: "now", "12m", "3h", "2d", "5w". */
export function shortAge(iso: string, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return days < 14 ? `${days}d` : `${Math.floor(days / 7)}w`
}

const ago = (iso: string, now: number) => {
  const age = shortAge(iso, now)
  return age === 'now' ? 'just now' : `${age} ago`
}

const names = (logins: string[]) =>
  logins.length <= 2
    ? logins.join(', ')
    : `${logins.slice(0, 2).join(', ')} +${logins.length - 2}`

function reviewerName(reviewer: PrReviewer): string {
  return 'team' in reviewer ? reviewer.team : reviewer.actor.login
}

const withState = (reviewers: PrReviewer[], state: PrReviewer['state']) =>
  reviewers.filter((r) => r.state === state).map(reviewerName)

function doneReason(pr: PullRequestSummary, now: number): string {
  return pr.state === 'merged' && pr.mergedAt !== null
    ? `Merged ${ago(pr.mergedAt, now)}`
    : 'Closed'
}

const threadsWaiting = (n: number) =>
  `${n} thread${n === 1 ? '' : 's'} wait${n === 1 ? 's' : ''} on you`

/** Why an open, non-draft PR of mine needs work, or null when nothing blocks it. */
function needsWork(pr: PullRequestSummary): PrPlacement | null {
  const requestedChanges = withState(pr.reviewers, 'CHANGES_REQUESTED')
  if (pr.reviewDecision === 'CHANGES_REQUESTED' || requestedChanges.length > 0) {
    const by = requestedChanges.length > 0 ? ` by ${names(requestedChanges)}` : ''
    return { column: 'needs_work', reason: `Changes requested${by}`, tone: 'waiting' }
  }
  if (pr.ci === 'failure') {
    const checks = pr.failingChecks.slice(0, 3).join(', ')
    const reason = checks ? `CI failed: ${checks}` : 'CI failed'
    return { column: 'needs_work', reason, tone: 'failed' }
  }
  if (pr.threads.waitingOnMe > 0) {
    const reason = threadsWaiting(pr.threads.waitingOnMe)
    return { column: 'needs_work', reason, tone: 'waiting' }
  }
  if (pr.mergeable === 'CONFLICTING') {
    return { column: 'needs_work', reason: 'Merge conflict', tone: 'failed' }
  }
  return null
}

function draftPlacement(pr: PullRequestSummary): PrPlacement {
  const cause =
    pr.ci === 'failure'
      ? ' · CI failing'
      : pr.mergeable === 'CONFLICTING'
        ? ' · Merge conflict'
        : ''
  return { column: 'draft', reason: `Draft${cause}`, tone: cause ? 'failed' : 'muted' }
}

function inReviewLead(pr: PullRequestSummary, approved: boolean): string {
  const waitingOn = withState(pr.reviewers, 'REQUESTED')
  if (waitingOn.length > 0) return `Waiting on ${names(waitingOn)}`
  if (approved) return 'Approved'
  return pr.reviewers.length === 0 ? 'No reviewer yet' : 'In review'
}

function placeMine(pr: PullRequestSummary, now: number): PrPlacement {
  if (pr.state !== 'open') return { column: 'done', reason: doneReason(pr, now), tone: 'muted' }
  if (pr.isDraft) return draftPlacement(pr)
  const blocked = needsWork(pr)
  if (blocked) return blocked

  const approvers = withState(pr.reviewers, 'APPROVED')
  const approved =
    pr.reviewDecision === 'APPROVED' || (pr.reviewDecision === null && approvers.length > 0)
  if (approved && (pr.ci === 'success' || pr.ci === 'none')) {
    const by = approvers.length > 0 ? `Approved by ${names(approvers)}` : 'Approved'
    const ci = pr.ci === 'none' ? 'no CI' : 'CI green'
    return { column: 'ready', reason: `${by} · ${ci}`, tone: 'muted' }
  }

  const parts = [inReviewLead(pr, approved)]
  if (pr.ci === 'pending') parts.push('CI running')
  return { column: 'in_review', reason: parts.join(' · '), tone: 'muted' }
}

/** A PR I haven't reviewed yet: why it is on my plate. */
function toReviewReason(pr: PullRequestSummary, now: number): string {
  const opened = ago(pr.createdAt, now)
  if (pr.requestedFromMe) return `Requested · opened ${opened}`
  if (pr.requestedFromMyTeam) return `Team request · opened ${opened}`
  return pr.assignedToMe ? 'Assigned' : `Opened ${opened}`
}

type MyLastReview = NonNullable<PullRequestSummary['myLastReview']>

/** Back on my plate after my review, or null. */
function reReview(
  last: MyLastReview,
  requestedFromMe: boolean,
  newCommits: boolean,
): PrPlacement | null {
  if (requestedFromMe) {
    const since = newCommits ? ' · new commits since your review' : ''
    return { column: 're_review', reason: `Re-requested${since}`, tone: 'waiting' }
  }
  if (last.state === 'CHANGES_REQUESTED' && newCommits) {
    const reason = 'New commits since you requested changes'
    return { column: 're_review', reason, tone: 'waiting' }
  }
  if (last.state === 'DISMISSED') {
    return { column: 're_review', reason: 'Your review was dismissed', tone: 'waiting' }
  }
  return null
}

function approvedTail(pr: PullRequestSummary, newCommits: boolean): string {
  if (newCommits) return 'new commits since'
  if (pr.reviewDecision === 'APPROVED') return 'approved'
  const more = withState(pr.reviewers, 'REQUESTED').length
  return more > 0 ? `waiting on ${more} more` : 'waiting on others'
}

function placeAssigned(pr: PullRequestSummary, now: number): PrPlacement {
  if (pr.state !== 'open') {
    const by = pr.state === 'merged' ? doneReason(pr, now) : 'Closed'
    return { column: 'done', reason: by, tone: 'muted' }
  }
  const last = pr.myLastReview
  if (last === null)
    return { column: 'to_review', reason: toReviewReason(pr, now), tone: 'waiting' }

  const newCommits = last.commitOid !== pr.headOid
  const back = reReview(last, pr.requestedFromMe, newCommits)
  if (back) return back
  if (last.state === 'APPROVED') {
    const reason = `You approved · ${approvedTail(pr, newCommits)}`
    return { column: 'approved', reason, tone: 'muted' }
  }

  // CHANGES_REQUESTED without new commits, COMMENTED (with or without), a draft.
  const what = last.state === 'CHANGES_REQUESTED' ? 'You requested changes' : 'You commented'
  const tail = newCommits ? ' · new commits since' : ''
  const reason = pr.isDraft
    ? `Draft · ${what.toLowerCase()}`
    : `${what} ${ago(last.submittedAt, now)}${tail}`
  return { column: 'waiting_author', reason, tone: 'muted' }
}

export function placePr(pr: PullRequestSummary, scope: PrScope, now = Date.now()): PrPlacement {
  return scope === 'mine' ? placeMine(pr, now) : placeAssigned(pr, now)
}

export interface PrBoardColumn extends PrColumnDef {
  items: { pr: PullRequestSummary; placement: PrPlacement }[]
}

/** The board: every column of the scope with its PRs, threads waiting on me first, then newest. */
export function buildPrColumns(
  items: PullRequestSummary[],
  scope: PrScope,
  now = Date.now(),
): PrBoardColumn[] {
  const columns = columnsFor(scope).map((def) => ({
    ...def,
    items: [] as PrBoardColumn['items'],
  }))
  for (const pr of items) {
    const placement = placePr(pr, scope, now)
    columns.find((c) => c.key === placement.column)?.items.push({ pr, placement })
  }
  for (const column of columns) {
    column.items.sort(
      (a, b) =>
        Number(b.pr.threads.waitingOnMe > 0) - Number(a.pr.threads.waitingOnMe > 0) ||
        b.pr.updatedAt.localeCompare(a.pr.updatedAt),
    )
  }
  return columns
}

/** The sidebar pill: Mine = Needs work; Assigned = To review + Re-review. */
export function needsYouCount(
  items: PullRequestSummary[],
  scope: PrScope,
  now = Date.now(),
): number {
  const needsYou = new Set(
    columnsFor(scope)
      .filter((c) => c.needsYou)
      .map((c) => c.key),
  )
  return items.filter((pr) => needsYou.has(placePr(pr, scope, now).column)).length
}
