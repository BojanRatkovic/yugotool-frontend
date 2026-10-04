import { describe, expect, it } from 'vitest'

import { browserPermission, shouldNotify } from './browser-notifications'

describe('shouldNotify', () => {
  it('needs the opt-in, a granted permission and a hidden tab', () => {
    const base = { optedIn: true, permission: 'granted' as const, hidden: true }
    expect(shouldNotify(base)).toBe(true)
    expect(shouldNotify({ ...base, optedIn: false })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'default' })).toBe(false)
    expect(shouldNotify({ ...base, permission: 'denied' })).toBe(false)
    expect(shouldNotify({ ...base, hidden: false })).toBe(false)
  })
})

describe('browserPermission', () => {
  it('reads the API, or unsupported without one', () => {
    expect(browserPermission({ Notification: { permission: 'granted' } })).toBe('granted')
    expect(browserPermission({})).toBe('unsupported')
  })
})
