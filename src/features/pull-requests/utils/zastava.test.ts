import { describe, expect, it } from 'vitest'

import {
  defaultSelection,
  findingPlace,
  findingsLabel,
  fromBrief,
  postPayload,
  zastavaState,
} from '@/features/pull-requests/utils/zastava'

describe('zastavaState', () => {
  it('counts the findings not posted yet', () => {
    const state = zastavaState({ status: 'succeeded', findings: 4, posted: 1, stale: false })
    expect(state).toEqual({ kind: 'done', findings: 4, open: 3, stale: false })
    if (state.kind === 'done') expect(findingsLabel(state)).toBe('3 findings')
  })

  it('says when everything is posted or there was nothing', () => {
    expect(findingsLabel({ kind: 'done', findings: 2, open: 0, stale: false })).toBe('2 posted')
    expect(findingsLabel({ kind: 'done', findings: 0, open: 0, stale: false })).toBe(
      'No findings',
    )
  })

  it('treats a cancelled review as none and a failed one as failed', () => {
    expect(
      zastavaState({ status: 'cancelled', findings: null, posted: 0, stale: false }),
    ).toEqual({ kind: 'none' })
    expect(
      zastavaState({ status: 'failed', findings: null, posted: 0, stale: false }).kind,
    ).toBe('failed')
  })

  it('marks a card stale when the head moved', () => {
    const brief = {
      number: 1,
      status: 'succeeded' as const,
      headOid: 'a',
      findings: 1,
      posted: 0,
    }
    expect(fromBrief(brief, 'b')).toMatchObject({ kind: 'done', stale: true })
    expect(fromBrief(undefined, 'b')).toEqual({ kind: 'none' })
  })
})

const finding = (id: string, severity: 'critical' | 'important' | 'minor') => ({
  id,
  severity,
  category: 'bug' as const,
  file: 'src/a.ts',
  side: 'RIGHT' as const,
  startLine: null,
  line: 3,
  title: `title ${id}`,
  body: `body ${id}`,
  suggestion: null,
  confidence: 'high' as const,
})

describe('triage', () => {
  const findings = [
    finding('f1', 'critical'),
    finding('f2', 'minor'),
    finding('f3', 'important'),
  ]

  it('picks critical and important findings not posted yet', () => {
    expect([...defaultSelection(findings, ['f3'])]).toEqual(['f1'])
  })

  it('sends the picked, unposted findings with edits, in review order', () => {
    const payload = postPayload(findings, new Set(['f3', 'f1', 'f2']), ['f2'], {
      f3: { title: '  ', body: 'edited', suggestion: 'x()' },
    })
    expect(payload.findings).toEqual([
      { id: 'f1', title: 'title f1', body: 'body f1', suggestion: null },
      { id: 'f3', title: 'title f3', body: 'edited', suggestion: 'x()' },
    ])
  })

  it('formats where a finding points', () => {
    expect(findingPlace({ file: 'a.ts', line: 9, startLine: 7 })).toBe('a.ts:7–9')
    expect(findingPlace({ file: 'a.ts', line: null, startLine: null })).toBe('a.ts')
    expect(findingPlace({ file: null, line: null, startLine: null })).toBeNull()
  })
})
