import { describe, expect, it } from 'vitest'

import { originLabel } from '@/features/projects/utils/remote'

describe('originLabel', () => {
  it('shortens https, ssh and scp-style origins', () => {
    expect(originLabel('https://github.com/acme/storefront.git')).toBe(
      'github.com/acme/storefront',
    )
    expect(originLabel('git@github.com:acme/frontend.git')).toBe(
      'github.com/acme/frontend',
    )
    expect(originLabel('ssh://git@gitlab.com/team/app')).toBe('gitlab.com/team/app')
  })

  it('leaves unknown shapes alone', () => {
    expect(originLabel('/srv/git/app.git')).toBe('/srv/git/app.git')
  })
})
