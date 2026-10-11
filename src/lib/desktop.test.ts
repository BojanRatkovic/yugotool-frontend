import { describe, expect, it, vi } from 'vitest'

import { desktopBridge, syncDesktopTheme } from '@/lib/desktop'

describe('desktopBridge', () => {
  it('is null in a browser', () => {
    expect(desktopBridge({})).toBeNull()
    expect(desktopBridge(undefined)).toBeNull()
    expect(desktopBridge(window)).toBeNull()
  })

  it('is null when the bridge is malformed', () => {
    expect(desktopBridge({ yugotoolDesktop: null })).toBeNull()
    expect(desktopBridge({ yugotoolDesktop: 'yes' })).toBeNull()
    expect(desktopBridge({ yugotoolDesktop: { platform: 'darwin' } })).toBeNull()
  })

  it('returns the bridge when pickFolder is a function', () => {
    const bridge = { platform: 'darwin', pickFolder: () => Promise.resolve('/tmp/x') }
    expect(desktopBridge({ yugotoolDesktop: bridge })).toBe(bridge)
  })
})

const pickFolder = () => Promise.resolve(null)

describe('syncDesktopTheme', () => {
  it('sends the resolved theme to the shell', () => {
    const setTheme = vi.fn()
    syncDesktopTheme('light', { platform: 'darwin', pickFolder, setTheme })
    syncDesktopTheme('dark', { platform: 'darwin', pickFolder, setTheme })
    expect(setTheme.mock.calls).toEqual([['light'], ['dark']])
  })

  it('skips unresolved or unknown themes', () => {
    const setTheme = vi.fn()
    syncDesktopTheme(undefined, { platform: 'darwin', pickFolder, setTheme })
    syncDesktopTheme('system', { platform: 'darwin', pickFolder, setTheme })
    expect(setTheme).not.toHaveBeenCalled()
  })

  it('is a no-op in a browser or an older shell without setTheme', () => {
    expect(() => syncDesktopTheme('dark', null)).not.toThrow()
    expect(() => syncDesktopTheme('dark', { platform: 'darwin', pickFolder })).not.toThrow()
  })
})
