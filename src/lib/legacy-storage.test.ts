import { beforeEach, describe, expect, it } from 'vitest'

import { moveLegacyStorage } from '@/lib/legacy-storage'

describe('moveLegacyStorage', () => {
  beforeEach(() => localStorage.clear())

  it('moves zastava keys to yugotool ones and keeps newer values', () => {
    localStorage.setItem('zastava.pr-merge-method', 'squash')
    localStorage.setItem('zastava:browser-notifications', 'on')
    localStorage.setItem('yugotool:browser-notifications', 'off')
    localStorage.setItem('theme', 'dark')
    moveLegacyStorage()
    expect(localStorage.getItem('yugotool.pr-merge-method')).toBe('squash')
    expect(localStorage.getItem('yugotool:browser-notifications')).toBe('off')
    expect(localStorage.getItem('zastava.pr-merge-method')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
