/** Link helpers: pull request URLs, linkifying plain text, delivery messages. */

export interface PullRequest {
  url: string
  /** null when the URL isn't a recognisable `…/pull/<n>` link. */
  number: number | null
  /** `owner/repo` for GitHub URLs. */
  repo: string | null
}

export function parsePullRequest(url: string): PullRequest {
  const github = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/.exec(url)
  if (github !== null) {
    return { url, number: Number(github[3]), repo: `${github[1]}/${github[2]}` }
  }
  const pull = /\/pulls?\/(\d+)/.exec(url)
  return { url, number: pull?.[1] === undefined ? null : Number(pull[1]), repo: null }
}

/** "PR #1145", or "Pull request" when the number can't be read. */
export function pullRequestLabel(pr: Pick<PullRequest, 'number'>, prefix = 'PR'): string {
  return pr.number === null ? 'Pull request' : `${prefix} #${pr.number}`
}

export type TextPart = { kind: 'text'; value: string } | { kind: 'link'; value: string }

// http(s) URLs; trailing punctuation that usually ends a sentence is left out.
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/g

/** Splits text into plain runs and http(s) links, in order. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index
    if (start > last) parts.push({ kind: 'text', value: text.slice(last, start) })
    parts.push({ kind: 'link', value: match[0] })
    last = start + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })
  return parts
}

export type Delivery =
  | { kind: 'pull_request'; pr: PullRequest }
  | { kind: 'pushed'; branch: string; remote: string | null }
  | { kind: 'committed'; branch: string }

/** Reads the worker's delivery summary (the run-level system event after the last station). */
export function parseDelivery(message: string): Delivery | null {
  const pr = /^Pull request opened: (\S+)/.exec(message)
  if (pr?.[1] !== undefined) return { kind: 'pull_request', pr: parsePullRequest(pr[1]) }
  const pushed = /^Pushed (\S+) to origin(?: \(([^)]*)\))?/.exec(message)
  if (pushed?.[1] !== undefined) {
    return { kind: 'pushed', branch: pushed[1], remote: pushed[2] ?? null }
  }
  const committed = /^Committed on (\S+)/.exec(message)
  if (committed?.[1] !== undefined) return { kind: 'committed', branch: committed[1] }
  return null
}
