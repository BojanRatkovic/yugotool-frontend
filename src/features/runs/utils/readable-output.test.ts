import { describe, expect, it } from 'vitest'

import { gateReading, readableOutput } from '@/features/runs/utils/readable-output'
import type { StationRun } from '@/lib/contracts'

const agent = { kind: 'agent' as const }
type Readable = Pick<StationRun, 'output' | 'research' | 'status'>
const done = (
  output: string | null,
  extra: Partial<Omit<Readable, 'output'>> = {},
): Readable => ({ output, research: null, status: 'succeeded', ...extra })

describe('readable output', () => {
  it('reads an agent’s answer, preferring Research’s plan, and skips the rest', () => {
    expect(readableOutput(agent, done('## Plan\n\n1. Do it'))).toBe('## Plan\n\n1. Do it')
    expect(
      readableOutput(
        agent,
        done('{"plan":"…"}', { research: { plan: '# Plan', repo: 'api' } }),
      ),
    ).toBe('# Plan')
    expect(readableOutput(agent, done('   '))).toBeNull()
    expect(readableOutput(agent, done(null))).toBeNull()
    expect(readableOutput({ kind: 'checks' }, done('npm test ok'))).toBeNull()
    expect(readableOutput(undefined, done('text'))).toBeNull()
    expect(
      readableOutput(agent, done('Reviewer: redo', { status: 'changes_requested' })),
    ).toBeNull()
  })

  it('gives a gate the closest earlier agent answer, latest attempt first', () => {
    const stations = [
      { key: 'research', kind: 'agent' as const, name: 'Research' },
      { key: 'plan', kind: 'gate' as const, name: 'Plan review' },
      { key: 'build', kind: 'agent' as const, name: 'Build' },
      { key: 'checks', kind: 'checks' as const, name: 'Checks' },
      { key: 'final', kind: 'gate' as const, name: 'Final review' },
    ]
    const runs = [
      { stationKey: 'research', ...done('first plan') },
      { stationKey: 'research', ...done('revised plan') },
      { stationKey: 'build', ...done('built it') },
      { stationKey: 'checks', ...done('all green') },
    ]
    expect(gateReading(stations, runs, 'plan')).toEqual({
      stationName: 'Research',
      text: 'revised plan',
    })
    expect(gateReading(stations, runs, 'final')).toEqual({
      stationName: 'Build',
      text: 'built it',
    })
    expect(gateReading(stations, [], 'final')).toBeNull()
    expect(gateReading(stations, runs, 'missing')).toBeNull()
  })
})
