import type { PrThread, PullRequestDetail } from '@/lib/contracts'

export type ThreadFilter = 'waiting' | 'unresolved' | 'resolved' | 'all'

/**
 * Waiting on me: unresolved, the last comment isn't mine, and it's mine to
 * answer (my PR, or a thread I started). Same rule as the API's counts.
 */
export function waitsOnMe(thread: PrThread, pr: PullRequestDetail, viewer: string): boolean {
  if (thread.isResolved) return false
  const first = thread.comments[0]?.author.login
  const last = thread.comments.at(-1)?.author.login
  return last !== viewer && (pr.author.login === viewer || first === viewer)
}

export function filterThreads(
  threads: PrThread[],
  filter: ThreadFilter,
  pr: PullRequestDetail,
  viewer: string,
): PrThread[] {
  switch (filter) {
    case 'waiting':
      return threads.filter((t) => waitsOnMe(t, pr, viewer))
    case 'unresolved':
      return threads.filter((t) => !t.isResolved)
    case 'resolved':
      return threads.filter((t) => t.isResolved)
    default:
      return threads
  }
}

/** The last `count` lines of a thread's diff hunk (the code it's about), without the @@ header. */
export function hunkTail(diffHunk: string, count = 6): string[] {
  return diffHunk
    .split('\n')
    .filter((line) => !line.startsWith('@@'))
    .slice(-count)
}

/** My pending comments, for the review dialog: where and the first line. */
export function pendingComments(
  pr: PullRequestDetail,
): { id: string; where: string; text: string }[] {
  return pr.reviewThreads.flatMap((thread) =>
    thread.comments
      .filter((c) => c.isPending)
      .map((c) => ({
        id: c.id,
        where: `${thread.path}${thread.line === null ? '' : `:${thread.line}`}`,
        text:
          (new DOMParser().parseFromString(c.bodyHtml, 'text/html').body.textContent ?? '')
            .trim()
            .split('\n')[0] ?? '',
      })),
  )
}
