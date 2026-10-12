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

function placeMine(pr: PullRequestSummary, now: number): PrPlacement {
  if (pr.state !== 'open') return { column: 'done', reason: doneReason(pr, now), tone: 'muted' }
  const ciFailed = pr.ci === 'failure'
  const conflict = pr.mergeable === 'CONFLICTING'
  const ciLine =
    pr.failingChecks.length > 0
      ? `CI failed: ${pr.failingChecks.slice(0, 3).join(', ')}`
      : 'CI failed'

  if (pr.isDraft) {
    const cause = ciFailed ? ' · CI failing' : conflict ? ' · Merge conflict' : ''
    return { column: 'draft', reason: `Draft${cause}`, tone: cause ? 'failed' : 'muted' }
  }

  const requestedChanges = withState(pr.reviewers, 'CHANGES_REQUESTED')
  if (pr.reviewDecision === 'CHANGES_REQUESTED' || requestedChanges.length > 0) {
    const by = requestedChanges.length > 0 ? ` by ${names(requestedChanges)}` : ''
    return { column: 'needs_work', reason: `Changes requested${by}`, tone: 'waiting' }
  }
  if (ciFailed) return { column: 'needs_work', reason: ciLine, tone: 'failed' }
  if (pr.threads.waitingOnMe > 0) {
    return {
      column: 'needs_work',
      reason: threadsWaiting(pr.threads.waitingOnMe),
      tone: 'waiting',
    }
  }
  if (conflict) return { column: 'needs_work', reason: 'Merge conflict', tone: 'failed' }

  const approvers = withState(pr.reviewers, 'APPROVED')
  const approved =
    pr.reviewDecision === 'APPROVED' || (pr.reviewDecision === null && approvers.length > 0)
  if (approved && (pr.ci === 'success' || pr.ci === 'none')) {
    const by = approvers.length > 0 ? `Approved by ${names(approvers)}` : 'Approved'
    return {
      column: 'ready',
      reason: `${by} · ${pr.ci === 'none' ? 'no CI' : 'CI green'}`,
      tone: 'muted',
    }
  }

  const waitingOn = withState(pr.reviewers, 'REQUESTED')
  const parts = [
    waitingOn.length > 0
      ? `Waiting on ${names(waitingOn)}`
      : approved
        ? 'Approved'
        : pr.reviewers.length === 0
          ? 'No reviewer yet'
          : 'In review',
  ]
  if (pr.ci === 'pending') parts.push('CI running')
  return { column: 'in_review', reason: parts.join(' · '), tone: 'muted' }
}

function placeAssigned(pr: PullRequestSummary, now: number): PrPlacement {
  if (pr.state !== 'open') {
    const by = pr.state === 'merged' ? doneReason(pr, now) : 'Closed'
    return { column: 'done', reason: by, tone: 'muted' }
  }
  const last = pr.myLastReview
  if (last === null) {
    const reason = pr.requestedFromMe
      ? `Requested · opened ${ago(pr.createdAt, now)}`
      : pr.requestedFromMyTeam
        ? `Team request · opened ${ago(pr.createdAt, now)}`
        : pr.assignedToMe
          ? 'Assigned'
          : `Opened ${ago(pr.createdAt, now)}`
    return { column: 'to_review', reason, tone: 'waiting' }
  }

  const newCommits = last.commitOid !== pr.headOid
  if (pr.requestedFromMe) {
    const since = newCommits ? ' · new commits since your review' : ''
    return { column: 're_review', reason: `Re-requested${since}`, tone: 'waiting' }
  }
  if (last.state === 'CHANGES_REQUESTED' && newCommits) {
    return {
      column: 're_review',
      reason: 'New commits since you requested changes',
      tone: 'waiting',
    }
  }
  if (last.state === 'DISMISSED') {
    return { column: 're_review', reason: 'Your review was dismissed', tone: 'waiting' }
  }

  if (last.state === 'APPROVED') {
    const more = withState(pr.reviewers, 'REQUESTED').length
    const tail = newCommits
      ? 'new commits since'
      : pr.reviewDecision === 'APPROVED'
        ? 'approved'
        : more > 0
          ? `waiting on ${more} more`
          : 'waiting on others'
    return { column: 'approved', reason: `You approved · ${tail}`, tone: 'muted' }
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
