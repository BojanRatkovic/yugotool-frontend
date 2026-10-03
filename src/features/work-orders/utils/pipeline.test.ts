import { describe, expect, it } from 'vitest'

import { pipelineFor } from '@/features/work-orders/utils/pipeline'

const stations = [
  { key: 'research', kind: 'agent' },
  { key: 'build', kind: 'agent' },
  { key: 'review', kind: 'gate' },
] as const

describe('pipelineFor', () => {
  it('marks every station queued in the backlog', () => {
    expect(pipelineFor({ status: 'backlog', stationKey: null }, stations)).toEqual([
      'queued',
      'queued',
      'queued',
    ])
  })

  it('marks every station queued while waiting for the dispatcher', () => {
    expect(pipelineFor({ status: 'queued', stationKey: null }, stations)).toEqual([
      'queued',
      'queued',
      'queued',
    ])
  })

  it('marks every station passed when done', () => {
    expect(pipelineFor({ status: 'done', stationKey: null }, stations)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
    ])
  })

  it('passes earlier stations and carries the status on the current one', () => {
    expect(pipelineFor({ status: 'awaiting_approval', stationKey: 'build' }, stations)).toEqual(
      ['succeeded', 'awaiting_approval', 'queued'],
    )
    expect(pipelineFor({ status: 'failed', stationKey: 'research' }, stations)).toEqual([
      'failed',
      'queued',
      'queued',
    ])
  })

  it('falls back to queued when the station is no longer on the line', () => {
    expect(pipelineFor({ status: 'running', stationKey: 'gone' }, stations)).toEqual([
      'queued',
      'queued',
      'queued',
    ])
  })

  it('places the repo-hooks preflight at the station before the last gate', () => {
    expect(pipelineFor({ status: 'running', stationKey: 'repo_hooks' }, stations)).toEqual([
      'succeeded',
      'running',
      'queued',
    ])
  })
})
