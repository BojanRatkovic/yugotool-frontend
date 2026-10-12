import { z } from 'zod'

import {
  imageEventSchema,
  type ImageEvent,
  type RunEvent,
  type StationRun,
} from '@/lib/contracts'

const recordSchema = z.record(z.string(), z.unknown())

export interface ToolCall {
  /** Tool name (`Read`, `Bash`, …) or `$` for a checks command. */
  tool: string
  /** The one argument worth reading: a relative path, a command, a pattern. */
  summary: string
}

/** Strips the worktree prefix so `/…/worktrees/<id>/src/a.ts` reads `src/a.ts`. */
export function relativize(text: string, worktreePath: string | null): string {
  if (worktreePath === null || worktreePath === '') return text
  const root = worktreePath.replace(/\/+$/, '')
  return text.split(`${root}/`).join('').split(root).join('.')
}

const KEY_PRIORITY = ['file_path', 'path', 'command', 'pattern', 'query', 'url', 'description']

/** First string value for a known key — tolerant of truncated JSON. */
function pickArgument(json: string): string | null {
  try {
    const parsed = recordSchema.safeParse(JSON.parse(json))
    if (parsed.success) {
      const record = parsed.data
      for (const key of KEY_PRIORITY) {
        const value = record[key]
        if (typeof value === 'string') return value
      }
      if (typeof record.verdict === 'string') return `verdict: ${record.verdict}`
      const first = Object.values(record).find((value) => typeof value === 'string')
      return typeof first === 'string' ? first : null
    }
  } catch {
    // The worker truncates long payloads; fall back to a regex.
  }
  for (const key of [...KEY_PRIORITY, 'verdict']) {
    const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(json)
    if (match?.[1] !== undefined) {
      const value = match[1].replaceAll('\\n', ' ').replaceAll('\\"', '"')
      return key === 'verdict' ? `verdict: ${value}` : value
    }
  }
  return null
}

const SCREEN = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"path"\s*:\s*"((?:[^"\\]|\\.)*)"/g

/**
 * The QA planner's output, `{"screens":[{name,path,reason}],"scenarios":[…]}`
 * → `Planned 2 screens: About page (/about.html), Home (/)`. Tolerates the
 * worker's truncation (screens are read with a regex); null when it isn't a plan.
 */
function planSummary(json: string): string | null {
  if (!/^\s*\{\s*"screens"\s*:/.test(json)) return null
  const screens = [...json.matchAll(SCREEN)].map(
    ([, name = '', path = '']) => `${name.replaceAll('\\"', '"')} (${path})`,
  )
  const noun = screens.length === 1 ? 'screen' : 'screens'
  const scenarios = /"scenarios"\s*:\s*\[\s*\{/.test(json)
  if (screens.length === 0) return scenarios ? 'Planned scenarios only' : 'Planned no screens'
  return `Planned ${screens.length} ${noun}: ${screens.join(', ')}`
}

/** `Read {"file_path":"/wt/math.js"}` → `{ tool: 'Read', summary: 'math.js' }`. */
export function parseToolCall(message: string, worktreePath: string | null): ToolCall {
  if (message.startsWith('$ ')) {
    return { tool: '$', summary: relativize(message.slice(2), worktreePath) }
  }
  const match = /^([\w.:-]+)\s*([\s\S]*)$/.exec(message)
  if (match === null) return { tool: 'Tool', summary: relativize(message, worktreePath) }
  const [, tool = 'Tool', rest = ''] = match
  const plan = tool === 'StructuredOutput' ? planSummary(rest) : null
  if (plan !== null) return { tool, summary: plan }
  const argument = rest.trimStart().startsWith('{') ? pickArgument(rest) : rest
  const summary = relativize(
    stripArtifactRoot((argument ?? rest).replaceAll(/\s+/g, ' ').trim()),
    worktreePath,
  )
  return { tool, summary }
}

/** `/…/.yugotool/artifacts/<runId>/qa/1/a.png` → `qa/1/a.png`. */
function stripArtifactRoot(text: string): string {
  return text.replaceAll(/\S*\/\.yugotool\/artifacts\/[0-9a-f-]{36}\//g, '')
}

/** `success · 8 turns · $0.0757` → 8. */
export function turnsFromResult(message: string): number | null {
  const match = /(\d+)\s+turns?/.exec(message)
  return match?.[1] === undefined ? null : Number(match[1])
}

export interface ActivityGroup {
  /** null = run-level events (workspace setup, before the first station). */
  stationRun: StationRun | null
  events: RunEvent[]
}

/** Events in order, grouped into consecutive blocks per station run. */
export function groupEvents(events: RunEvent[], stationRuns: StationRun[]): ActivityGroup[] {
  const byId = new Map(stationRuns.map((sr) => [sr.id, sr]))
  const groups: ActivityGroup[] = []
  for (const event of events) {
    const last = groups.at(-1)
    const stationRun =
      event.stationRunId === null ? null : (byId.get(event.stationRunId) ?? null)
    if (last !== undefined && last.stationRun?.id === stationRun?.id) {
      last.events.push(event)
    } else {
      groups.push({ stationRun, events: [event] })
    }
  }
  // Stations that started but haven't logged yet still get a header.
  const seen = new Set(groups.map((group) => group.stationRun?.id))
  for (const sr of stationRuns) {
    if (!seen.has(sr.id)) groups.push({ stationRun: sr, events: [] })
  }
  return groups
}

// ── Browser (Playwright MCP) calls ──────────────────────────────────────────

export interface BrowserCall {
  /** Human verb: open, click, type, screenshot, … */
  action: string
  /** What it acted on: an element description, a path, a key. Empty when none. */
  target: string
}

const PLAYWRIGHT_TOOL = /^mcp__playwright__(?:browser_)?(\w+)$/

const BROWSER_VERB: Record<string, string> = {
  navigate: 'open',
  navigate_back: 'back',
  navigate_forward: 'forward',
  click: 'click',
  type: 'type',
  fill_form: 'fill form',
  hover: 'hover',
  press_key: 'press',
  select_option: 'select',
  take_screenshot: 'screenshot',
  snapshot: 'snapshot',
  wait_for: 'wait',
  resize: 'resize',
  console_messages: 'console',
  network_requests: 'network',
  evaluate: 'evaluate',
  close: 'close',
  drag: 'drag',
  file_upload: 'upload',
  handle_dialog: 'dialog',
  tabs: 'tabs',
}

/** Arguments of a tool call: full JSON, or string fields salvaged from truncated JSON. */
function toolArguments(json: string): Record<string, unknown> {
  try {
    const parsed = recordSchema.safeParse(JSON.parse(json))
    if (parsed.success) return parsed.data
  } catch {
    // Truncated by the worker; fall through to the regex.
  }
  const record: Record<string, unknown> = {}
  for (const match of json.matchAll(
    /"(\w+)"\s*:\s*(?:"((?:[^"\\]|\\.)*)"?|(-?\d+(?:\.\d+)?))/g,
  )) {
    const [, key = '', text, number] = match
    record[key] = text === undefined ? Number(number) : text.replaceAll('\\"', '"')
  }
  return record
}

/** `https://localhost:5173/settings?x=1` → `/settings?x=1`; anything unparsable stays as is. */
function urlPath(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
}

/** `a:has-text("About")` → `About`; `text=Save` → `Save`; other selectors stay as they are. */
function humanSelector(selector: string): string {
  const hasText = /:has-text\((["'])(.*?)\1\)/.exec(selector)
  if (hasText?.[2] !== undefined) return hasText[2]
  const text = /^text=(["']?)(.*)\1$/.exec(selector)
  return text?.[2] ?? selector
}

/**
 * `mcp__playwright__browser_click {"element":"Submit button","ref":"e5"}` →
 * `{ action: 'click', target: 'Submit button' }`. Null for any other tool.
 */
export function parseBrowserCall(message: string): BrowserCall | null {
  const match = /^(\S+)\s*([\s\S]*)$/.exec(message)
  const tool = PLAYWRIGHT_TOOL.exec(match?.[1] ?? '')
  if (match === null || tool === null) return null
  const name = tool[1] ?? ''
  const rest = (match[2] ?? '').trim()
  const args = rest.startsWith('{') ? toolArguments(rest) : {}
  const action = BROWSER_VERB[name] ?? name.replaceAll('_', ' ')
  // Playwright MCP versions differ: `element` (a description) or `target` (a selector).
  const element = str(args.element) || humanSelector(str(args.target) || str(args.selector))
  let target: string
  switch (name) {
    case 'navigate':
      target = urlPath(str(args.url))
      break
    case 'type': {
      const text = str(args.text)
      target = text === '' ? element : `${element} · “${text}”`
      break
    }
    case 'press_key':
      target = str(args.key)
      break
    case 'wait_for':
      target =
        str(args.text) ||
        str(args.textGone) ||
        (str(args.time) === '' ? '' : `${str(args.time)}s`)
      break
    case 'resize':
      target = args.width === undefined ? '' : `${str(args.width)}×${str(args.height)}`
      break
    case 'drag':
      target = `${str(args.startElement)} → ${str(args.endElement)}`
      break
    case 'select_option': {
      const values = Array.isArray(args.values) ? args.values.map(str).join(', ') : ''
      target = values === '' ? element : `${element} · ${values}`
      break
    }
    default:
      target = element
  }
  return { action, target: target.replaceAll(/\s+/g, ' ').trim() }
}

// ── Image events ────────────────────────────────────────────────────────────

/** An `image` event's payload, or null when it isn't valid JSON of the contract shape. */
export function parseImageEvent(message: string): ImageEvent | null {
  try {
    const parsed = imageEventSchema.safeParse(JSON.parse(message))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export type ActivityItem =
  | { type: 'event'; event: RunEvent }
  | {
      type: 'images'
      /** The first event (time, key). */
      event: RunEvent
      images: ImageEvent[]
    }

const COMPARE_ROLES = new Set<ImageEvent['role']>(['base', 'pr', 'diff'])
const ROLE_ORDER: Record<ImageEvent['role'], number> = {
  base: 0,
  pr: 1,
  diff: 2,
  agent: 3,
  preview: 4,
}

/**
 * Rows for one station's events. Consecutive base/pr/diff images of the same
 * check fold into one row (Base · PR · Diff); every other image is its own row.
 */
export function activityItems(events: readonly RunEvent[]): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const event of events) {
    if (event.type !== 'image') {
      items.push({ type: 'event', event })
      continue
    }
    const image = parseImageEvent(event.message)
    if (image === null) {
      items.push({ type: 'event', event })
      continue
    }
    const last = items.at(-1)
    const joins =
      last?.type === 'images' &&
      image.checkId !== null &&
      COMPARE_ROLES.has(image.role) &&
      last.images.every(
        (other) =>
          other.checkId === image.checkId &&
          COMPARE_ROLES.has(other.role) &&
          other.role !== image.role,
      )
    if (joins && last.type === 'images') {
      last.images = [...last.images, image].toSorted(
        (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
      )
    } else {
      items.push({ type: 'images', event, images: [image] })
    }
  }
  return items
}

/** Caption for a folded Base/PR/Diff row: the shared part, without the role word. */
export function compareCaption(images: readonly ImageEvent[]): string {
  const first = images[0]?.caption ?? ''
  return first.replace(/[\s·:(\-–—]*\b(?:base|pr|diff)\b\)?\s*$/i, '').trim() || first
}

/**
 * Long error messages: the first line is the headline, the rest a log.
 * Short ones (≤ 3 lines) stay whole.
 */
export function splitErrorMessage(message: string): { head: string; log: string | null } {
  const text = message.trimEnd()
  const lines = text.split('\n')
  if (lines.length <= 3) return { head: text, log: null }
  const log = lines.slice(1).join('\n').replace(/^\n+/, '')
  return { head: lines[0] ?? '', log: log === '' ? null : log }
}

/** `Preview failed: … \n\n<log tail>` → the part after the first blank line, if any. */
export function logTail(message: string): string | null {
  const at = message.indexOf('\n\n')
  if (at < 0) return null
  const tail = message.slice(at + 2).trimEnd()
  return tail.trim() === '' ? null : tail
}

/** "Why: …", "Note: …" — a short labelled prose line, not log output. */
const NOTE_LINE = /^[A-Z][A-Za-z ]{0,23}: \S/

/**
 * A system line's head, the labelled prose lines that follow it (QA's
 * "Why: …" under "Changed: …"), and whatever else is left as raw output.
 */
export function splitSystemMessage(message: string): {
  head: string
  notes: string[]
  output: string | null
} {
  const [head = '', ...rest] = message.split('\n')
  const notes: string[] = []
  let index = 0
  while (index < rest.length && NOTE_LINE.test(rest[index] ?? '')) {
    notes.push(rest[index] ?? '')
    index += 1
  }
  const output = rest.slice(index).join('\n')
  return { head, notes, output: output.trim() === '' ? null : output }
}

/**
 * A tool call's JSON input, pretty-printed, when it says more than its
 * one-line summary (two or more keys). Truncated JSON comes back raw.
 */
export function toolInputJson(message: string): string | null {
  const match = /^[\w.:-]+\s*(\{[\s\S]*)$/.exec(message)
  const json = match?.[1]?.trim()
  if (json === undefined) return null
  try {
    const parsed = recordSchema.safeParse(JSON.parse(json))
    if (!parsed.success || Object.keys(parsed.data).length < 2) return null
    return JSON.stringify(parsed.data, null, 2)
  } catch {
    return json.length > 80 ? json : null
  }
}
