import { describe, expect, it } from 'vitest'

import { countByProject, projectActivity } from '@/features/projects/utils/project-activity'

describe('projectActivity', () => {
  it('is idle with nothing running or waiting', () => {
    expect(projectActivity(0, 0)).toEqual({ state: 'idle', label: null })
  })

  it('spins while anything runs, even with a gate waiting', () => {
    expect(projectActivity(1, 0)).toEqual({ state: 'running', label: '1 running' })
    expect(projectActivity(2, 1)).toEqual({
      state: 'running',
      label: '2 running, 1 waiting for approval',
    })
  })

  it('asks for attention when only a gate waits', () => {
    expect(projectActivity(0, 3)).toEqual({ state: 'waiting', label: '3 waiting for approval' })
  })
})

describe('countByProject', () => {
  it('counts per project id', () => {
    const counts = countByProject([{ projectId: 'a' }, { projectId: 'b' }, { projectId: 'a' }])
    expect([...counts]).toEqual([
      ['a', 2],
      ['b', 1],
    ])
  })
})
