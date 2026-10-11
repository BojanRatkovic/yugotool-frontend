import { afterEach, describe, expect, it } from 'vitest'

import { preferredMethod } from '@/features/pull-requests/components/pr-author-actions'

afterEach(() => localStorage.clear())

describe('preferredMethod', () => {
  it('remembers the last method when the repo allows it', () => {
    expect(preferredMethod(['merge', 'squash'])).toBe('merge')
    localStorage.setItem('yugotool.pr-merge-method', 'squash')
    expect(preferredMethod(['merge', 'squash'])).toBe('squash')
    expect(preferredMethod(['rebase'])).toBe('rebase')
    expect(preferredMethod([])).toBeNull()
  })
})
