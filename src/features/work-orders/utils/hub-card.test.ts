import { describe, expect, it } from 'vitest'

import { boardHub, followsLabel, repoChipLabel } from '@/features/work-orders/utils/hub-card'
const wo = (patch: { id?: string; title?: string; followsId?: string | null }) => ({
  id: 'a',
  title: 'Add API',
  repo: null,
  followsId: null,
  ...patch,
})

describe('hub board chips (spec 0014)', () => {
  it('shows the repo, or Auto before Research picks', () => {
    expect(repoChipLabel({ repo: 'shop-backend' })).toBe('shop-backend')
    expect(repoChipLabel({ repo: null })).toBe('Auto')
  })

  it('names the predecessor of a follower', () => {
    const hub = boardHub(
      ['api', 'web'],
      [wo({}), wo({ id: 'b', title: 'Use API', followsId: 'a' })],
    )
    expect(hub?.repos).toEqual(['api', 'web'])
    expect(followsLabel({ followsId: 'a' }, hub?.titles ?? new Map())).toBe('after Add API')
    expect(followsLabel({ followsId: 'gone' }, new Map())).toBe('after another work order')
    expect(followsLabel({ followsId: null }, new Map())).toBeNull()
  })

  it('repo projects have no hub board', () => {
    expect(boardHub(undefined, [wo({})])).toBeNull()
  })
})
