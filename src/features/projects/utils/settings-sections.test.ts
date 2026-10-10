import { describe, expect, it } from 'vitest'

import { shownSection, visibleSections } from '@/features/projects/utils/settings-sections'

describe('project settings sections (spec 0014)', () => {
  it('repo projects keep their tabs; hub projects get Repos instead of Preview and Routes', () => {
    expect(visibleSections('repo')).toEqual([
      'preview',
      'routes',
      'delivery',
      'knowledge',
      'general',
    ])
    expect(visibleSections('hub')).toEqual(['repos', 'delivery', 'knowledge', 'general'])
  })

  it('falls back to the first tab the project has', () => {
    expect(shownSection('hub', 'preview')).toBe('repos')
    expect(shownSection('repo', 'repos')).toBe('preview')
    expect(shownSection('repo', undefined)).toBe('preview')
    expect(shownSection('hub', 'delivery')).toBe('delivery')
  })
})
