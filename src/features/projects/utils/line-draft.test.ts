import { describe, expect, it } from 'vitest'

import {
  insertAfter,
  lineIssues,
  moveStation,
  newStation,
  removeStation,
  uniqueKey,
} from '@/features/projects/utils/line-draft'
import type { Station } from '@/lib/contracts'

const gate = (key: string): Station => ({ key, kind: 'gate', name: key, prompt: '' })

describe('line draft', () => {
  it('generates the first free key per kind', () => {
    expect(uniqueKey('gate', [gate('gate_1'), gate('gate_3')])).toBe('gate_2')
    expect(uniqueKey('checks', [])).toBe('checks_1')
  })

  it('inserts after the selected station, or appends', () => {
    const line = [gate('a'), gate('b')]
    expect(insertAfter(line, 'a', gate('x')).map((s) => s.key)).toEqual(['a', 'x', 'b'])
    expect(insertAfter(line, null, gate('x')).map((s) => s.key)).toEqual(['a', 'b', 'x'])
  })

  it('moves within bounds and removes', () => {
    const line = [gate('a'), gate('b'), gate('c')]
    expect(moveStation(line, 'b', -1).map((s) => s.key)).toEqual(['b', 'a', 'c'])
    expect(moveStation(line, 'c', 1).map((s) => s.key)).toEqual(['a', 'b', 'c'])
    expect(removeStation(line, 'b').map((s) => s.key)).toEqual(['a', 'c'])
  })

  it('reports field issues per station and general ones', () => {
    const agent = newStation('agent', [])
    const broken: Station = { key: 'checks_1', kind: 'checks', name: '', command: '' }
    const issues = lineIssues([agent, broken])
    expect(issues.byStation.has(agent.key)).toBe(false)
    expect([...(issues.byStation.get('checks_1')?.keys() ?? [])]).toEqual(['name', 'command'])
    expect(lineIssues([]).general).toHaveLength(1)
  })

  it('adds a QA station from the template with a free key', () => {
    const first = newStation('qa', [])
    expect(first).toMatchObject({ key: 'qa', kind: 'qa', viewports: ['desktop'] })
    expect(lineIssues([first]).byStation.size).toBe(0)
    expect(newStation('qa', [first]).key).toBe('qa_1')
  })

  it('flags an always-check row without a leading slash', () => {
    const qa = newStation('qa', [])
    if (qa.kind !== 'qa') throw new Error('expected a QA station')
    const broken: Station = { ...qa, alwaysCheck: [{ name: 'Home', path: 'home' }] }
    expect([...(lineIssues([broken]).byStation.get('qa')?.keys() ?? [])]).toEqual([
      'alwaysCheck',
    ])
  })
})

describe('lineIssues on a review line', () => {
  const reviewer: Station = {
    key: 'review',
    kind: 'agent',
    name: 'Review',
    role: 'pull-request-reviewer',
    model: 'claude-sonnet-5-5',
    allowedTools: ['Read'],
    canEdit: false,
    structuredVerdict: 'review',
    prompt: 'Review.',
  }

  it('accepts a reviewer with checks', () => {
    const checks: Station = { key: 'lint', kind: 'checks', name: 'Lint', command: 'pnpm lint' }
    expect(lineIssues([reviewer, checks], 'review').general).toEqual([])
  })

  it('needs a reviewer and refuses gates', () => {
    const { general } = lineIssues(
      [{ ...reviewer, structuredVerdict: true }, gate('g')],
      'review',
    )
    expect(general).toContain('a review line has no gates, shifts or stations that edit code')
    expect(general).toContain('a review line needs a reviewer station (structured review)')
  })
})
