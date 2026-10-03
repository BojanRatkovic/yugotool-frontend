import { routeEntrySchema, type RouteEntry } from '@/lib/contracts'

/** What the route edit dialog edits: strings, components one per line. */
export interface RouteValues {
  title: string
  path: string
  example: string
  description: string
  components: string
}

export type RouteField = keyof RouteValues

const ROUTE_FIELDS: readonly RouteField[] = [
  'title',
  'path',
  'example',
  'description',
  'components',
]

export const EMPTY_ROUTE: RouteValues = {
  title: '',
  path: '/',
  example: '/',
  description: '',
  components: '',
}

export function toRouteValues(route: RouteEntry): RouteValues {
  return {
    title: route.title,
    path: route.path,
    example: route.example,
    description: route.description,
    components: route.components.join('\n'),
  }
}

/** One file per line; blank lines and duplicates dropped, order kept. */
export function parseComponents(text: string): string[] {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  return [...new Set(lines)]
}

const MESSAGES: Record<RouteField, string> = {
  title: 'Give it a title (up to 120 characters).',
  path: 'The path pattern must start with “/” (up to 300 characters).',
  example: 'The example URL must start with “/” (up to 500 characters).',
  description: 'Keep the description under 500 characters.',
  components: 'Up to 30 files, one per line.',
}

export type RouteParse =
  | { ok: true; route: RouteEntry }
  | { ok: false; errors: Partial<Record<RouteField, string>> }

/** Dialog values → a route entry, or one message per broken field. */
export function parseRouteValues(values: RouteValues): RouteParse {
  const parsed = routeEntrySchema.safeParse({
    title: values.title,
    path: values.path,
    // An empty example falls back to the pattern: fine for routes without params.
    example: values.example.trim() === '' ? values.path : values.example,
    description: values.description,
    components: parseComponents(values.components),
  })
  if (parsed.success) return { ok: true, route: parsed.data }
  const errors: Partial<Record<RouteField, string>> = {}
  for (const issue of parsed.error.issues) {
    const field = ROUTE_FIELDS.find((name) => name === issue.path[0])
    if (field !== undefined) errors[field] = MESSAGES[field]
  }
  return { ok: false, errors }
}

/** The list with `index` replaced (or appended when index is null). */
export function upsertRoute(
  routes: readonly RouteEntry[],
  index: number | null,
  route: RouteEntry,
): RouteEntry[] {
  if (index === null || index < 0 || index >= routes.length) return [...routes, route]
  return routes.map((existing, i) => (i === index ? route : existing))
}
