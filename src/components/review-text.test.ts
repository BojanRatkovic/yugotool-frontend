import { describe, expect, it } from 'vitest'

import { leadSentence } from '@/components/review-text'

describe('leadSentence', () => {
  it('splits the first sentence from the rest', () => {
    expect(leadSentence('The gate passes. Tests are green. Done!')).toEqual([
      'The gate passes.',
      'Tests are green. Done!',
    ])
  })

  it('does not split inside inline code', () => {
    expect(leadSentence('Rename `e.g. foo.ts` now. Then rerun.')).toEqual([
      'Rename `e.g. foo.ts` now.',
      'Then rerun.',
    ])
  })

  it('keeps a single sentence whole', () => {
    expect(leadSentence('`health.ignore` has no reason')).toEqual([
      '`health.ignore` has no reason',
      '',
    ])
  })
})
