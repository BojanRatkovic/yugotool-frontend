import { describe, expect, it } from 'vitest'

import {
  EMPTY_ROUTE,
  parseComponents,
  parseRouteValues,
  toRouteValues,
  upsertRoute,
} from '@/features/projects/utils/route-form'
import type { RouteEntry } from '@/lib/contracts'

const route: RouteEntry = {
  title: 'Project',
  path: '/projects/:id',
  example: '/projects/482',
  description: 'One project with its board.',
  components: ['src/routes/project.tsx', 'src/features/board.tsx'],
}

describe('parseComponents', () => {
  it('splits lines, trims, drops blanks and duplicates', () => {
    expect(parseComponents(' a.tsx \n\nb.tsx\na.tsx\n  ')).toEqual(['a.tsx', 'b.tsx'])
  })
})

describe('parseRouteValues', () => {
  it('round-trips an entry', () => {
    expect(parseRouteValues(toRouteValues(route))).toEqual({ ok: true, route })
  })

  it('falls back to the pattern when the example is empty', () => {
    const result = parseRouteValues({ ...EMPTY_ROUTE, title: 'Home', path: '/', example: ' ' })
    expect(result).toEqual({
      ok: true,
      route: { title: 'Home', path: '/', example: '/', description: '', components: [] },
    })
  })

  it('reports each broken field', () => {
    const result = parseRouteValues({
      ...EMPTY_ROUTE,
      title: '  ',
      path: 'projects',
      example: 'nope',
      components: Array.from({ length: 31 }, (_, i) => `f${i}.tsx`).join('\n'),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).toSorted()).toEqual([
      'components',
      'example',
      'path',
      'title',
    ])
  })
})

describe('upsertRoute', () => {
  const other: RouteEntry = { ...route, title: 'Home', path: '/', example: '/' }

  it('replaces the row at index', () => {
    expect(upsertRoute([route, other], 1, { ...other, title: 'Start' })[1]?.title).toBe('Start')
  })

  it('appends when index is null', () => {
    expect(upsertRoute([route], null, other)).toEqual([route, other])
  })
})
