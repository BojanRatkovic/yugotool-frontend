import type { Station, StationRun } from '@/lib/contracts'

type ReadableRun = Pick<StationRun, 'output' | 'research' | 'status'>

/** An agent's written answer (a plan, a summary, a review), worth opening in the reader; null otherwise. */
export function readableOutput(
  station: Pick<Station, 'kind'> | undefined,
  stationRun: ReadableRun,
): string | null {
  if (station?.kind !== 'agent') return null
  // A sent-back gate stores the reviewer's comment in `output`; the feed quotes it already.
  if (stationRun.status === 'changes_requested') return null
  const text = stationRun.research?.plan ?? stationRun.output
  return text === null || text.trim() === '' ? null : text
}

/**
 * What a gate asks you to approve: the closest earlier agent's latest answer
 * in this run (Research's plan at a plan gate, Build's summary at the last one).
 */
export function gateReading(
  stations: readonly Pick<Station, 'key' | 'kind' | 'name'>[],
  stationRuns: readonly (ReadableRun & Pick<StationRun, 'stationKey'>)[],
  gateKey: string,
): { stationName: string; text: string } | null {
  const gateIndex = stations.findIndex((station) => station.key === gateKey)
  for (let i = gateIndex - 1; i >= 0; i--) {
    const station = stations[i]
    if (station === undefined) continue
    const latest = stationRuns.findLast((sr) => sr.stationKey === station.key)
    const text = latest === undefined ? null : readableOutput(station, latest)
    if (text !== null) return { stationName: station.name, text }
  }
  return null
}
