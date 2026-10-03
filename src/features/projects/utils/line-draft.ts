import {
  QA_STATION_TEMPLATE,
  updateLineSchema,
  updateReviewLineSchema,
  type LineKind,
  type Station,
} from '@/lib/contracts'

export const AGENT_TOOLS: readonly string[] = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash',
  'WebFetch',
  'WebSearch',
]

export type StationKind = Station['kind']

/** Handoff threshold bounds (percent of the context window), as the API enforces them. */
export const SHIFT_HANDOFF_MIN = 30
export const SHIFT_HANDOFF_MAX = 80
export const SHIFT_HANDOFF_DEFAULT = 50
/** The 40–60% band HumanLayer-style "intentional compaction" recommends. */
export const SHIFT_HANDOFF_RECOMMENDED = [40, 60] as const

/** Where a percent sits on the handoff slider's track, 0–100. */
export function handoffTrackPct(value: number): number {
  const clamped = Math.min(SHIFT_HANDOFF_MAX, Math.max(SHIFT_HANDOFF_MIN, value))
  return ((clamped - SHIFT_HANDOFF_MIN) / (SHIFT_HANDOFF_MAX - SHIFT_HANDOFF_MIN)) * 100
}

/** Sort key keeping known tools in canonical order, unknown ones last. */
export function toolOrder(tool: string): number {
  const index = AGENT_TOOLS.indexOf(tool)
  return index < 0 ? AGENT_TOOLS.length : index
}

/** First `<kind>_<n>` key not already taken (matches the API's key regex). */
export function uniqueKey(kind: StationKind, stations: readonly Station[]): string {
  const taken = new Set(stations.map((station) => station.key))
  let n = 1
  while (taken.has(`${kind}_${n}`)) n += 1
  return `${kind}_${n}`
}

export function newStation(kind: StationKind, stations: readonly Station[]): Station {
  if (kind === 'qa') {
    const taken = stations.some((station) => station.key === QA_STATION_TEMPLATE.key)
    return {
      ...QA_STATION_TEMPLATE,
      key: taken ? uniqueKey(kind, stations) : QA_STATION_TEMPLATE.key,
      // Fresh arrays: the template is shared, drafts are edited in place by the form.
      viewports: [...QA_STATION_TEMPLATE.viewports],
      themes: [...QA_STATION_TEMPLATE.themes],
      alwaysCheck: [],
    }
  }
  const key = uniqueKey(kind, stations)
  if (kind === 'gate') return { key, kind, name: 'New gate', prompt: '' }
  if (kind === 'checks') return { key, kind, name: 'Checks', command: 'pnpm test' }
  if (kind === 'shift') {
    return {
      key,
      kind,
      name: 'Shifts',
      role: 'builder',
      model: 'claude-sonnet-5-5',
      allowedTools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
      prompt: '',
      goal: '',
      doneCommand: null,
      handoffAtPct: SHIFT_HANDOFF_DEFAULT,
      maxShifts: 8,
      reviewHandoff: false,
    }
  }
  return {
    key,
    kind: 'agent',
    name: 'New agent',
    role: 'agent',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read', 'Grep', 'Glob'],
    canEdit: false,
    prompt: '',
  }
}

/** Inserts after `afterKey`, or appends when it's null/unknown. */
export function insertAfter(
  stations: readonly Station[],
  afterKey: string | null,
  station: Station,
): Station[] {
  const index = stations.findIndex((s) => s.key === afterKey)
  const at = index < 0 ? stations.length : index + 1
  return [...stations.slice(0, at), station, ...stations.slice(at)]
}

export function removeStation(stations: readonly Station[], key: string): Station[] {
  return stations.filter((station) => station.key !== key)
}

/** Swaps with the neighbour; a no-op at either end. */
export function moveStation(
  stations: readonly Station[],
  key: string,
  direction: -1 | 1,
): Station[] {
  const from = stations.findIndex((station) => station.key === key)
  const to = from + direction
  if (from < 0 || to < 0 || to >= stations.length) return [...stations]
  const next = [...stations]
  const a = next[from]
  const b = next[to]
  if (a === undefined || b === undefined) return next
  next[from] = b
  next[to] = a
  return next
}

export function replaceStation(stations: readonly Station[], station: Station): Station[] {
  return stations.map((s) => (s.key === station.key ? station : s))
}

export interface LineIssues {
  /** Issues per station key, keyed by field ("" for the station itself). */
  byStation: Map<string, Map<string, string>>
  /** Issues not tied to one station (e.g. empty line, duplicate keys). */
  general: string[]
}

/** Client-side check with the same schema the API enforces. */
export function lineIssues(stations: readonly Station[], kind: LineKind = 'build'): LineIssues {
  const schema = kind === 'review' ? updateReviewLineSchema : updateLineSchema
  const result = schema.safeParse({ stations })
  const issues: LineIssues = { byStation: new Map(), general: [] }
  if (result.success) return issues
  for (const issue of result.error.issues) {
    const [root, index, field] = issue.path
    const station = typeof index === 'number' ? stations[index] : undefined
    if (root !== 'stations' || station === undefined) {
      issues.general.push(issue.message)
      continue
    }
    const fields = issues.byStation.get(station.key) ?? new Map<string, string>()
    const name = typeof field === 'string' ? field : ''
    const message =
      issue.code === 'too_small' && issue.origin === 'string' ? 'Required.' : issue.message
    if (!fields.has(name)) fields.set(name, message)
    issues.byStation.set(station.key, fields)
  }
  return issues
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    )
  }
  return value
}

/** Deep equality that ignores key order and undefined fields. */
export function sameStations(a: readonly Station[], b: readonly Station[]): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}
