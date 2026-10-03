import { describe, expect, it } from 'vitest'

import { tildePath } from '@/lib/format'

describe('tildePath', () => {
  it('shortens home folders', () => {
    expect(tildePath('/Users/bojan/Desktop/Developer')).toBe('~/Desktop/Developer')
    expect(tildePath('/home/ana/code')).toBe('~/code')
    expect(tildePath('/Users/bojan')).toBe('~')
  })

  it('leaves other paths alone', () => {
    expect(tildePath('/opt/repos')).toBe('/opt/repos')
    expect(tildePath('/Users')).toBe('/Users')
  })
})
