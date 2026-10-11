import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DETAILS_RAIL_KEY,
  isDetailsRailKey,
  readDetailsRailOpen,
  writeDetailsRailOpen,
} from '@/features/work-orders/utils/details-rail'

const press = (init: Partial<KeyboardEvent>) =>
  isDetailsRailKey({ key: ']', metaKey: false, ctrlKey: false, altKey: false, ...init })

function blocked(): never {
  throw new Error('blocked')
}

describe('details rail preference', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('is open by default', () => {
    expect(readDetailsRailOpen()).toBe(true)
  })

  it('remembers hiding and showing', () => {
    writeDetailsRailOpen(false)
    expect(localStorage.getItem(DETAILS_RAIL_KEY)).toBe('0')
    expect(readDetailsRailOpen()).toBe(false)
    writeDetailsRailOpen(true)
    expect(readDetailsRailOpen()).toBe(true)
  })

  it('treats blocked storage as open and never throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    expect(readDetailsRailOpen()).toBe(true)
    expect(() => writeDetailsRailOpen(false)).not.toThrow()
  })
})

describe('isDetailsRailKey', () => {
  it('takes ] plain, with Option or with AltGr', () => {
    expect(press({})).toBe(true)
    expect(press({ altKey: true })).toBe(true)
    expect(press({ ctrlKey: true, altKey: true })).toBe(true)
  })

  it('leaves ⌘] and Ctrl+] and other keys alone', () => {
    expect(press({ metaKey: true })).toBe(false)
    expect(press({ ctrlKey: true })).toBe(false)
    expect(press({ key: '[' })).toBe(false)
  })
})
