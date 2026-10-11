import { describe, expect, it } from 'vitest'

import {
  CI_STATION,
  REPO_HOOKS_STATION,
  stationStates,
} from '@/features/runs/utils/station-states'
import type { Run, Station, StationRun } from '@/lib/contracts'

const stations: Station[] = [
  { key: 'build', kind: 'checks', name: 'Build', command: 'make' },
  { key: 'gate', kind: 'gate', name: 'Review', prompt: '' },
]

function stationRun(partial: Partial<StationRun>): StationRun {
  return {
    id: crypto.randomUUID(),
    runId: crypto.randomUUID(),
    stationKey: 'build',
    attempt: 1,
    status: 'succeeded',
    sessionId: null,
    model: null,
    authSource: null,
    accountLabel: null,
    output: null,
    verdict: null,
    error: null,
    research: null,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    contextTokens: 0,
    contextWindow: null,
    numTurns: 0,
    shift: null,
    qa: null,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    ...partial,
  }
}

function run(status: Run['status'], srs: StationRun[]): Run {
  return {
    id: crypto.randomUUID(),
    workOrderId: crypto.randomUUID(),
    status,
    workflowId: 'w',
    worktreePath: null,
    repo: null,
    costUsd: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
    stations: srs,
  }
}

describe('stationStates', () => {
  it('queues everything without a run', () => {
    expect(stationStates(stations, undefined).map((s) => s.status)).toEqual([
      'queued',
      'queued',
    ])
  })

  it('uses the latest attempt and skips unreached stations of a finished run', () => {
    const states = stationStates(
      stations,
      run('failed', [
        stationRun({ attempt: 1, status: 'failed' }),
        stationRun({ attempt: 2, status: 'failed' }),
      ]),
    )
    expect(states.map((s) => [s.status, s.attempts])).toEqual([
      ['failed', 2],
      ['skipped', 0],
    ])
  })
})

describe('repo hooks step', () => {
  it('is inserted before the last gate when the run had the preflight', () => {
    const states = stationStates(
      stations,
      run('failed', [
        stationRun({ stationKey: 'build' }),
        stationRun({ stationKey: 'repo_hooks', status: 'failed' }),
        stationRun({ stationKey: 'repo_hooks', attempt: 2, status: 'succeeded' }),
      ]),
    )
    expect(states.map((state) => state.station.key)).toEqual(['build', 'repo_hooks', 'gate'])
    expect(states[1]).toMatchObject({
      station: REPO_HOOKS_STATION,
      attempts: 2,
      status: 'succeeded',
    })
  })

  it('is absent when the run never ran it', () => {
    const states = stationStates(
      stations,
      run('succeeded', [stationRun({ stationKey: 'build' })]),
    )
    expect(states.map((state) => state.station.key)).toEqual(['build', 'gate'])
  })
})

describe('CI step', () => {
  it('comes last, after repo hooks and the gate, when the run watched CI', () => {
    const states = stationStates(
      stations,
      run('succeeded', [
        stationRun({ stationKey: 'build' }),
        stationRun({ stationKey: 'repo_hooks' }),
        stationRun({ stationKey: 'gate' }),
        stationRun({ stationKey: 'ci', status: 'failed', output: '1 failed · 3 passed' }),
      ]),
    )
    expect(states.map((state) => state.station.key)).toEqual([
      'build',
      'repo_hooks',
      'gate',
      'ci',
    ])
    expect(states[3]).toMatchObject({ station: CI_STATION, status: 'failed' })
  })

  it('shows "no CI" and timeouts as skipped, not cancelled', () => {
    const states = stationStates(
      stations,
      run('succeeded', [stationRun({ stationKey: 'ci', status: 'cancelled' })]),
    )
    expect(states.at(-1)?.status).toBe('skipped')
  })
})
