// Pure: what a gate decision sends, or why it can't be sent yet.
import type { DeliveryMode, GateDecision } from '@/lib/contracts'

type Decision = GateDecision['decision']

export type GateRequest =
  | { kind: 'send'; body: GateDecision; delivery: DeliveryMode | undefined }
  /** Request changes without a comment: ask for one. */
  | { kind: 'needs_comment' }
  /** A hub plan gate approved without a repo: ask for one. */
  | { kind: 'needs_repo' }
  /** Request changes where nothing comes before the gate: nothing to do. */
  | { kind: 'none' }

/**
 * The request for a decision. Approve carries the delivery (final gate) and
 * the repo (hub plan gate); the other decisions carry only the comment.
 */
export function gateRequest(input: {
  decision: Decision
  comment: string
  /** The delivery to approve with; undefined when this gate doesn't deliver. */
  delivery: DeliveryMode | undefined
  canRequestChanges: boolean
  /** Hub plan gate: the chosen repo (null = none yet); undefined elsewhere. */
  repo: string | null | undefined
}): GateRequest {
  const { decision, comment } = input
  if (decision === 'request_changes') {
    if (!input.canRequestChanges) return { kind: 'none' }
    if (comment.trim() === '') return { kind: 'needs_comment' }
  }
  if (decision === 'approve' && input.repo === null) return { kind: 'needs_repo' }
  const delivery = decision === 'approve' ? input.delivery : undefined
  const repo = decision === 'approve' ? (input.repo ?? null) : null
  return {
    kind: 'send',
    delivery,
    body: {
      decision,
      comment,
      ...(delivery === undefined ? {} : { delivery }),
      ...(repo === null ? {} : { repo }),
    },
  }
}
