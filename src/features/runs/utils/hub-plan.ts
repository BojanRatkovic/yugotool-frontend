import type { SplitItem, StationResearch } from '@/lib/contracts'

/** Research's latest answer in a hub run (spec 0014): repo and optional split. */
export function latestResearch(
  run: { stations: { research: StationResearch | null }[] } | undefined,
): StationResearch | null {
  if (run === undefined) return null
  for (let i = run.stations.length - 1; i >= 0; i--) {
    const research = run.stations[i]?.research
    if (research != null) return research
  }
  return null
}

/** The repo the plan gate starts on: the work order's preset, else Research's pick. */
export function suggestedRepo(
  presetRepo: string | null,
  research: StationResearch | null,
  repos: string[],
): string | null {
  const pick = presetRepo ?? research?.split?.[0]?.repo ?? research?.repo ?? null
  return pick !== null && repos.includes(pick) ? pick : null
}

/** "api → web → api" for a split's summary line. */
export function splitRoute(items: SplitItem[]): string {
  return items.map((item) => item.repo).join(' → ')
}
