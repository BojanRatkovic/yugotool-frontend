import { describe, expect, it } from 'vitest'

import { confirmsDelete } from '@/features/projects/utils/delete-project'

describe('confirmsDelete', () => {
  it('needs the exact name, trimmed', () => {
    expect(confirmsDelete('QA Lab', 'QA Lab')).toBe(true)
    expect(confirmsDelete('  QA Lab ', 'QA Lab')).toBe(true)
    expect(confirmsDelete('qa lab', 'QA Lab')).toBe(false)
    expect(confirmsDelete('QA', 'QA Lab')).toBe(false)
    expect(confirmsDelete('', 'QA Lab')).toBe(false)
  })

  it('never matches an empty name', () => {
    expect(confirmsDelete('', '  ')).toBe(false)
  })
})
