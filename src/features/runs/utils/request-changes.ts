import { requestChangesTarget, type Station } from '@/lib/contracts'

export interface RequestChangesCopy {
  /** Station the work goes back to, e.g. "Research" or "Build". */
  target: string
  /** Tooltip on "Request changes": where it goes and what happens next. */
  hint: string
  placeholder: string
}

/**
 * What "Request changes" at this gate does, in words; null when nothing comes
 * before the gate to send the work back to (the button is hidden then).
 */
export function requestChangesCopy(
  stations: readonly Station[],
  gateKey: string,
): RequestChangesCopy | null {
  const gateIndex = stations.findIndex((s) => s.key === gateKey)
  if (gateIndex === -1) return null
  const index = requestChangesTarget([...stations], gateIndex)
  const station = stations[index]
  if (station === undefined) return null
  const edits = (station.kind === 'agent' && station.canEdit) || station.kind === 'shift'
  return {
    target: station.name,
    hint: edits
      ? `Sends it back to ${station.name} with your comment; it reruns the stations after it and stops here again.`
      : `Sends it back to ${station.name} with your comment; you’ll review the revised plan here again.`,
    placeholder: `What should ${station.name} change? (required for Request changes)`,
  }
}
