import { describe, expect, it } from 'vitest'

import {
  defaultSelection,
  findingPlace,
  findingsLabel,
  fromBrief,
  ghostFindings,
  fixedReply,
  postPayload,
  previousCounts,
  previousRows,
  stillOpenReply,
  yugotoolState,
} from '@/features/pull-requests/utils/yugotool'
import type { YugoToolReview } from '@/lib/contracts'

describe('yugotoolState', () => {
  it('counts the findings not posted yet', () => {
    const state = yugotoolState({ status: 'succeeded', findings: 4, posted: 1, stale: false })
    expect(state).toEqual({ kind: 'done', findings: 4, open: 3, stale: false, reReview: false })
    if (state.kind === 'done') expect(findingsLabel(state)).toBe('3 findings')
  })

  it('says when everything is posted or there was nothing', () => {
    expect(
      findingsLabel({ kind: 'done', findings: 2, open: 0, stale: false, reReview: false }),
    ).toBe('2 posted')
    expect(
      findingsLabel({ kind: 'done', findings: 0, open: 0, stale: false, reReview: false }),
    ).toBe('No findings')
  })

  it('treats a cancelled review as none and a failed one as failed', () => {
    expect(
      yugotoolState({ status: 'cancelled', findings: null, posted: 0, stale: false }),
    ).toEqual({ kind: 'none' })
    expect(
      yugotoolState({ status: 'failed', findings: null, posted: 0, stale: false }).kind,
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
    expect(fromBrief(brief, 'b')).toMatchObject({ kind: 'done', stale: true, reReview: true })
    expect(fromBrief({ ...brief, findings: 0 }, 'b')).toMatchObject({ reReview: false })
    expect(fromBrief(brief, 'a')).toMatchObject({ reReview: false })
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

const prev = (id: string) => ({
  id,
  severity: 'important' as const,
  category: 'bug',
  file: 'src/a.ts',
  line: 3,
  title: `title ${id}`,
  body: 'b',
  posted: true,
  threadId: `T-${id}`,
  threadResolved: false,
})

describe('re-review (spec 0010)', () => {
  it('pairs each previous finding with its status, unchecked when missing', () => {
    const rows = previousRows(
      [prev('f1'), prev('f2'), prev('f3'), prev('f4'), prev('f5')],
      [
        { id: 'f1', status: 'fixed', note: 'src/a.ts:4' },
        { id: 'f2', status: 'fixed', note: '' },
        { id: 'f3', status: 'partly', note: 'one call left' },
        { id: 'f4', status: 'open', note: 'src/a.ts:9' },
      ],
    )
    expect(rows.map((r) => r.status)).toEqual(['fixed', 'fixed', 'partly', 'open', 'unchecked'])
    expect(previousCounts(rows)).toBe('2 fixed · 1 partly · 1 still open · 1 not checked')
    expect(previousCounts(rows.slice(0, 2))).toBe('2 fixed')
  })

  it('prefills the replies', () => {
    expect(fixedReply('abcdef1234')).toBe('Fixed in abcdef1.')
    const [open, partly, bare] = previousRows(
      [prev('f1'), prev('f2'), prev('f3')],
      [
        { id: 'f1', status: 'open', note: 'src/a.ts:9 still reads items[0]' },
        { id: 'f2', status: 'partly', note: 'one call left' },
        { id: 'f3', status: 'open', note: ' ' },
      ],
    )
    expect(open && stillOpenReply(open)).toBe('Still open: src/a.ts:9 still reads items[0]')
    expect(partly && stillOpenReply(partly)).toBe('Partly fixed: one call left')
    expect(bare && stillOpenReply(bare)).toBe('Still open.')
  })
})

function reviewWith(patch: { stale?: boolean; posted?: string[] } = {}): YugoToolReview {
  return {
    workOrderId: '9d1b0c5e-1111-4222-8333-444455556666',
    runId: null,
    status: 'succeeded',
    costUsd: 0,
    pullRequest: {
      number: 1,
      url: 'https://github.com/acme/app/pull/1',
      headRefName: 'feat',
      headOid: 'a'.repeat(40),
      baseRefName: 'main',
      baseOid: 'b'.repeat(40),
      sinceOid: null,
      openThreads: [],
      posted: patch.posted ?? [],
      postedThreads: {},
      previousFindings: [],
    },
    stale: patch.stale ?? false,
    verdict: {
      recommendation: 'comment',
      summary: '',
      findings: [
        finding('a', 'critical'),
        { ...finding('b', 'minor'), line: null },
        { ...finding('c', 'minor'), file: 'src/other.ts' },
        finding('d', 'important'),
      ],
      previous: [],
    },
    error: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
  }
}

describe('ghostFindings', () => {
  it('keeps line findings of the file that are neither posted nor dismissed', () => {
    expect(ghostFindings(reviewWith(), 'src/a.ts', new Set()).map((f) => f.id)).toEqual([
      'a',
      'd',
    ])
    expect(
      ghostFindings(reviewWith({ posted: ['a'] }), 'src/a.ts', new Set(['d'])).map((f) => f.id),
    ).toEqual([])
  })

  it('shows nothing for a stale review or none', () => {
    expect(ghostFindings(reviewWith({ stale: true }), 'src/a.ts', new Set())).toEqual([])
    expect(ghostFindings(null, 'src/a.ts', new Set())).toEqual([])
  })
})
