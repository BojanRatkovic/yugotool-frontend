import { withQaStation, type Station } from '@/lib/contracts'

export interface QaOffer {
  /** The line with QA inserted after the last station that edits code. */
  stations: Station[]
  /** Name of the station QA lands after, e.g. "Build". */
  after: string
}

/** What adding QA would do, or null when the line has QA already or nothing edits code. */
export function qaOffer(stations: Station[]): QaOffer | null {
  const next = withQaStation(stations)
  if (next === stations) return null
  const index = next.findIndex((station) => !stations.some((s) => s.key === station.key))
  return { stations: next, after: next[index - 1]?.name ?? 'the last station' }
}

/** Offer QA once the preview has passed a test, the line can take it, and it wasn't dismissed. */
export function shouldOfferQa({
  previewOk,
  stations,
  dismissed,
}: {
  previewOk: boolean
  stations: Station[] | undefined
  dismissed: boolean
}): boolean {
  return previewOk && !dismissed && stations !== undefined && qaOffer(stations) !== null
}

const dismissKey = (projectId: string) => `zastava:offer-qa-dismissed:${projectId}`

/** "Not now" is remembered per project in this browser; storage errors mean "not dismissed". */
export function isQaOfferDismissed(projectId: string): boolean {
  try {
    return window.localStorage.getItem(dismissKey(projectId)) === '1'
  } catch {
    return false
  }
}

export function dismissQaOffer(projectId: string): void {
  try {
    window.localStorage.setItem(dismissKey(projectId), '1')
  } catch {
    // Private mode or blocked storage: the offer comes back next visit.
  }
}
