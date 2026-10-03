import { placePr } from '@/features/pull-requests/utils/columns'
import type { PrReviewer, PullRequestDetail } from '@/lib/contracts'

/** ok = green, fail = blocks, wait = someone has to act, none = nothing to say. */
export type ChipState = 'ok' | 'fail' | 'wait' | 'none'

export interface Readiness {
  /** One sentence: whose move it is and why. */
  verdict: string
  tone: 'ok' | 'failed' | 'waiting' | 'muted'
  reviews: { approved: number; total: number; state: ChipState }
  checks: { passed: number; total: number; state: ChipState }
  threads: { open: number; waitingOnMe: number; state: ChipState }
  mergeable: ChipState
}

const name = (r: PrReviewer) => ('team' in r ? r.team : r.actor.login)

/** "ana", "ana and marko", "ana, marko and 2 more". */
function people(list: string[]): string {
  if (list.length <= 1) return list[0] ?? ''
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`
}

const possessive = (list: string[]) =>
  list.length === 1 ? `${list[0]}'s review` : `reviews from ${people(list)}`

function chips(pr: PullRequestDetail): Omit<Readiness, 'verdict' | 'tone'> {
  const counted = pr.reviewers.filter((r) => r.state !== 'COMMENTED' && r.state !== 'DISMISSED')
  const approved = counted.filter((r) => r.state === 'APPROVED').length
  const relevant = pr.checks.filter((c) => c.state !== 'skipping' && c.state !== 'cancel')
  return {
    reviews: {
      approved,
      total: counted.length,
      state:
        pr.reviewDecision === 'CHANGES_REQUESTED'
          ? 'fail'
          : pr.reviewDecision === 'APPROVED' || (pr.reviewDecision === null && approved > 0)
            ? 'ok'
            : counted.length === 0
              ? 'none'
              : 'wait',
    },
    checks: {
      passed: relevant.filter((c) => c.state === 'pass').length,
      total: relevant.length,
      state:
        pr.ci === 'failure'
          ? 'fail'
          : pr.ci === 'pending'
            ? 'wait'
            : pr.ci === 'success'
              ? 'ok'
              : 'none',
    },
    threads: {
      open: pr.threads.unresolved,
      waitingOnMe: pr.threads.waitingOnMe,
      state: pr.threads.waitingOnMe > 0 ? 'wait' : pr.threads.unresolved > 0 ? 'none' : 'ok',
    },
    // UNKNOWN until GitHub computes it: never shown as a blocker.
    mergeable:
      pr.mergeable === 'CONFLICTING' ? 'fail' : pr.mergeable === 'MERGEABLE' ? 'ok' : 'none',
  }
}

const threadsWait = (n: number) =>
  `${n} thread${n === 1 ? '' : 's'} wait${n === 1 ? 's' : ''} on you.`

function mineVerdict(pr: PullRequestDetail): Pick<Readiness, 'verdict' | 'tone'> {
  if (pr.state === 'merged') return { verdict: 'Merged.', tone: 'muted' }
  if (pr.state === 'closed') return { verdict: 'Closed without merging.', tone: 'muted' }
  if (pr.isDraft)
    return { verdict: 'Draft: mark it ready for review when it is.', tone: 'muted' }
  const changes = pr.reviewers.filter((r) => r.state === 'CHANGES_REQUESTED').map(name)
  if (pr.reviewDecision === 'CHANGES_REQUESTED' || changes.length > 0) {
    const who = changes.length > 0 ? people(changes) : 'A reviewer'
    return { verdict: `${who} requested changes.`, tone: 'waiting' }
  }
  if (pr.ci === 'failure') {
    const failing = pr.failingChecks.slice(0, 2)
    const what = failing.length > 0 ? `${failing.join(', ')} failed` : 'checks failed'
    return { verdict: `Fix CI: ${what}.`, tone: 'failed' }
  }
  if (pr.threads.waitingOnMe > 0)
    return { verdict: threadsWait(pr.threads.waitingOnMe), tone: 'waiting' }
  if (pr.mergeable === 'CONFLICTING') {
    return { verdict: `Resolve the merge conflict with ${pr.baseRefName}.`, tone: 'failed' }
  }
  const placement = placePr(pr, 'mine')
  if (placement.column === 'ready') return { verdict: 'Ready to merge.', tone: 'ok' }
  const requested = pr.reviewers.filter((r) => r.state === 'REQUESTED').map(name)
  if (requested.length > 0)
    return { verdict: `Waiting on ${possessive(requested)}.`, tone: 'muted' }
  if (pr.ci === 'pending') return { verdict: 'Waiting on CI.', tone: 'muted' }
  if (pr.reviewers.length === 0) return { verdict: 'Request a review.', tone: 'waiting' }
  return { verdict: 'In review.', tone: 'muted' }
}

function assignedVerdict(pr: PullRequestDetail): Pick<Readiness, 'verdict' | 'tone'> {
  const placement = placePr(pr, 'assigned')
  switch (placement.column) {
    case 'done':
      return {
        verdict: pr.state === 'merged' ? 'Merged.' : 'Closed without merging.',
        tone: 'muted',
      }
    case 'to_review':
      return { verdict: 'Your review is next.', tone: 'waiting' }
    case 're_review':
      return {
        verdict: `Your review is next: ${lowerFirst(placement.reason)}.`,
        tone: 'waiting',
      }
    default:
      break
  }
  if (pr.threads.waitingOnMe > 0)
    return { verdict: threadsWait(pr.threads.waitingOnMe), tone: 'waiting' }
  if (placement.column === 'waiting_author') {
    return { verdict: `Waiting on the author: ${lowerFirst(placement.reason)}.`, tone: 'muted' }
  }
  const others = pr.reviewers
    .filter(
      (r) => r.state === 'REQUESTED' && !('actor' in r && r.actor.login === pr.author.login),
    )
    .map(name)
  return {
    verdict:
      others.length > 0 ? `You approved. Waiting on ${possessive(others)}.` : 'You approved.',
    tone: 'ok',
  }
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/** The panel's readiness strip: a verdict for whoever is looking, plus four chips. */
export function readiness(pr: PullRequestDetail, viewer: string): Readiness {
  const verdict = pr.author.login === viewer ? mineVerdict(pr) : assignedVerdict(pr)
  return { ...verdict, ...chips(pr) }
}
