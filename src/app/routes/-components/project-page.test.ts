import { describe, expect, it } from 'vitest'

import { panelSearchPatch } from '@/app/routes/-components/project-page'

describe('panelSearchPatch', () => {
  it('keeps Activity out of the URL', () => {
    expect(panelSearchPatch({ tab: 'activity' })).toEqual({ woTab: undefined })
    expect(panelSearchPatch({ tab: 'qa' })).toEqual({ woTab: 'qa' })
  })

  it('resets shift and QA selection when the run changes', () => {
    expect(panelSearchPatch({ run: 'r2', station: undefined })).toEqual({
      station: undefined,
      run: 'r2',
      shift: undefined,
      qaAttempt: undefined,
      qaCheck: undefined,
    })
  })

  it('only sets woFull when going full page', () => {
    expect(panelSearchPatch({ full: true })).toEqual({ woFull: true })
    expect(panelSearchPatch({ full: false })).toEqual({ woFull: undefined })
  })

  it('touches nothing for an empty change', () => {
    expect(panelSearchPatch({})).toEqual({})
  })
})
