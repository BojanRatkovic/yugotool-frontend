import { describe, expect, it } from 'vitest'

import { documentTitle } from '@/app/routes/-components/use-needs-you'

describe('documentTitle', () => {
  it('leads with the waiting count wherever you are', () => {
    expect(documentTitle(2, 'QA Lab')).toBe('(2) ZASTAVA')
    expect(documentTitle(1, undefined)).toBe('(1) ZASTAVA')
  })

  it('names the project when nothing waits', () => {
    expect(documentTitle(0, 'QA Lab')).toBe('QA Lab · ZASTAVA')
    expect(documentTitle(0, undefined)).toBe('ZASTAVA')
  })
})
