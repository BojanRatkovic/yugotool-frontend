import { describe, expect, it } from 'vitest'

import { followReducer, INITIAL_FOLLOW, isNearBottom } from '@/hooks/stick-to-bottom'

function box(scrollTop: number) {
  return { scrollTop, scrollHeight: 1000, clientHeight: 400 }
}

describe('isNearBottom', () => {
  it('counts the last 48px as the bottom', () => {
    expect(isNearBottom(box(600))).toBe(true)
    expect(isNearBottom(box(552))).toBe(true)
    expect(isNearBottom(box(551))).toBe(false)
    expect(isNearBottom(box(0))).toBe(false)
  })

  it('treats a list that does not overflow as at the bottom', () => {
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 400 })).toBe(true)
  })
})

describe('followReducer', () => {
  const following = followReducer(INITIAL_FOLLOW, { type: 'scrolled', nearBottom: true })

  it('follows at the bottom and ignores appends there', () => {
    expect(following).toEqual({ following: true, unseen: 0 })
    expect(followReducer(following, { type: 'appended', count: 3 })).toBe(following)
  })

  it('stops following when scrolled up and counts new rows', () => {
    const up = followReducer(following, { type: 'scrolled', nearBottom: false })
    expect(up.following).toBe(false)
    const twice = followReducer(followReducer(up, { type: 'appended', count: 2 }), {
      type: 'appended',
      count: 1,
    })
    expect(twice).toEqual({ following: false, unseen: 3 })
  })

  it('resumes on jump or on scrolling back down', () => {
    const behind = { following: false, unseen: 4 }
    expect(followReducer(behind, { type: 'jumped' })).toEqual({ following: true, unseen: 0 })
    expect(followReducer(behind, { type: 'scrolled', nearBottom: true })).toEqual({
      following: true,
      unseen: 0,
    })
  })
})
