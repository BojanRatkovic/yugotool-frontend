import { describe, expect, it } from 'vitest'

import { desktopBridge } from '@/lib/desktop'

describe('desktopBridge', () => {
  it('is null in a browser', () => {
    expect(desktopBridge({})).toBeNull()
    expect(desktopBridge(undefined)).toBeNull()
    expect(desktopBridge(window)).toBeNull()
  })

  it('is null when the bridge is malformed', () => {
    expect(desktopBridge({ zastavaDesktop: null })).toBeNull()
    expect(desktopBridge({ zastavaDesktop: 'yes' })).toBeNull()
    expect(desktopBridge({ zastavaDesktop: { platform: 'darwin' } })).toBeNull()
  })

  it('returns the bridge when pickFolder is a function', () => {
    const bridge = { platform: 'darwin', pickFolder: () => Promise.resolve('/tmp/x') }
    expect(desktopBridge({ zastavaDesktop: bridge })).toBe(bridge)
  })
})
