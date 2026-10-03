import { parseDelivery } from '@/lib/links'
import { stripAnsi } from '@/lib/code-language'
import type { Run, RunEvent } from '@/lib/contracts'

export interface RunFailure {
  kind: 'failed' | 'rejected' | 'cancelled'
  /** "Failed", "Delivery failed", "Rejected", "Cancelled". */
  title: string
  /** The one line that says why; null when nothing was logged. */
  reason: string | null
  /** The whole logged message (ANSI stripped), for the expanded view. */
  detail: string | null
  /** `work is safe on <branch>` from a delivery failure. */
  safeBranch: string | null
  /** The event to scroll to in Activity. */
  eventId: string | null
}

const DELIVERY_FAILED = /^Delivery failed(?: \(work is safe on ([^)\s]+)\))?:\s*/

/** A line that names the problem: `✖ commit-msg: …`, `file.ts:3:1: error …`, `Error: …`. */
const PROBLEM_LINE = /^(?:[✖✗×]|error\b)|\berror\b/i

/** Wrappers the worker and the Agent SDK put around the real cause. */
const WRAPPER_PREFIX =
  /^(?:(?:Activity task|Handoff turn) failed:|Claude Code returned an error result:)\s*/i
const MAX_TURNS = /maximum number of turns\s*\((\d+)\)/i
const MAX_BUDGET = /maximum budget|max_budget/i
const AMOUNT = /\$\s?(\d+(?:\.\d+)?)/

/**
 * The cause in words a person acts on: drops the `Activity task failed:` /
 * `Claude Code returned an error result:` wrappers and names known limits
 * (turns, budget) with what to do next. Delivery failures pass through as-is.
 */
export function friendlyFailure(error: string): string {
  const text = error.trim()
  if (DELIVERY_FAILED.test(text)) return text
  let body = text
  for (let previous = ''; previous !== body;) {
    previous = body
    body = body.replace(WRAPPER_PREFIX, '')
  }
  const turns = MAX_TURNS.exec(body)
  if (turns !== null) {
    return `Ran out of turns (${turns[1]}). Raise the station's turn limit or split the work order.`
  }
  if (MAX_BUDGET.test(body)) {
    const amount = AMOUNT.exec(body)
    return amount === null ? 'Hit the budget cap.' : `Hit the budget cap ($${amount[1]}).`
  }
  return body === '' ? text : body
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !/^[│┃╭╰─\s]+$/u.test(line))
}

function problemLine(text: string): string | null {
  return (
    lines(text).find(
      (line) => !line.startsWith('Command failed:') && PROBLEM_LINE.test(line),
    ) ?? null
  )
}

/**
 * One readable line for a run-level error. The worker's last error can be
 * just `Command failed: git commit …`; the hook output that says why is often
 * in the error before it, so earlier errors are searched too.
 */
function summarize(message: string, earlier: readonly string[]): string {
  const body = stripAnsi(message).replace(DELIVERY_FAILED, '')
  const found =
    problemLine(body) ??
    earlier
      .toReversed()
      .map((text) => problemLine(stripAnsi(text).replace(DELIVERY_FAILED, '')))
      .find((line) => line !== null)
  if (found != null) return found
  const all = lines(body)
  return all.find((line) => !line.startsWith('Command failed:')) ?? all[0] ?? body.trim()
}

function fromError(
  kind: RunFailure['kind'],
  error: RunEvent,
  earlierErrors: readonly RunEvent[],
): RunFailure {
  const head = DELIVERY_FAILED.exec(error.message)
  const title = kind === 'failed' ? (head === null ? 'Failed' : 'Delivery failed') : TITLE[kind]
  return {
    kind,
    title,
    reason: friendlyFailure(
      summarize(
        error.message,
        // Only a delivery failure's own earlier log (the hook output), never unrelated errors.
        head === null
          ? []
          : earlierErrors
              .filter((event) => DELIVERY_FAILED.test(event.message))
              .map((event) => event.message),
      ),
    ),
    detail: stripAnsi(error.message).trimEnd(),
    safeBranch: head?.[1] ?? null,
    eventId: error.id,
  }
}

const TITLE: Record<RunFailure['kind'], string> = {
  failed: 'Failed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const isRunLevel = (event: RunEvent) => event.stationRunId === null

/**
 * Why the run didn't deliver, from its run-level events (the worker's
 * finishRun writes the reason as a run-level `error`). Also catches legacy
 * "succeeded" runs whose last delivery event is a "Delivery failed" error.
 * Null when the run delivered or is still going.
 */
export function runFailure(run: Run, events: readonly RunEvent[]): RunFailure | null {
  const errors = events.filter((event) => isRunLevel(event) && event.type === 'error')
  if (run.status === 'succeeded') {
    const lastDelivery = events.findLast(
      (event) =>
        isRunLevel(event) &&
        ((event.type === 'system' && parseDelivery(event.message) !== null) ||
          (event.type === 'error' && DELIVERY_FAILED.test(event.message))),
    )
    if (lastDelivery?.type !== 'error') return null
    return fromError(
      'failed',
      lastDelivery,
      errors.filter((event) => event.seq < lastDelivery.seq),
    )
  }
  if (run.status !== 'failed' && run.status !== 'rejected' && run.status !== 'cancelled') {
    return null
  }
  const last = errors.at(-1)
  if (last !== undefined) return fromError(run.status, last, errors.slice(0, -1))
  // No run-level reason: the station that failed (or the gate that rejected) says why.
  const station = run.stations.findLast((sr) => sr.error !== null || sr.status === run.status)
  const text = station?.error ?? station?.output ?? null
  return {
    kind: run.status,
    title: TITLE[run.status],
    reason: text === null ? null : friendlyFailure(lines(stripAnsi(text))[0] ?? text),
    detail: text === null ? null : stripAnsi(text).trimEnd(),
    safeBranch: null,
    eventId: null,
  }
}
