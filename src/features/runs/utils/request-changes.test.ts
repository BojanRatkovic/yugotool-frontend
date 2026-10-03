import { describe, expect, it } from 'vitest'

import { requestChangesCopy } from '@/features/runs/utils/request-changes'
import type { Station } from '@/lib/contracts'

const agent = (key: string, name: string, canEdit: boolean): Station => ({
  key,
  kind: 'agent',
  name,
  role: key,
  model: 'claude-haiku-4-5-20251001',
  effort: 'low',
  allowedTools: [],
  canEdit,
  prompt: '',
})
const gate = (key: string, name: string): Station => ({ key, kind: 'gate', name, prompt: '' })

const line = [
  agent('research', 'Research', false),
  gate('plan_gate', 'Approve plan'),
  agent('build', 'Build', true),
  agent('validate', 'Validate', false),
  gate('final', 'Final review'),
]

describe('requestChangesCopy', () => {
  it('sends a plan gate back to the researcher for a revised plan', () => {
    const copy = requestChangesCopy(line, 'plan_gate')
    expect(copy?.target).toBe('Research')
    expect(copy?.placeholder).toBe(
      'What should Research change? (required for Request changes)',
    )
    expect(copy?.hint).toContain('review the revised plan here again')
  })

  it('sends the final gate back to the closest station that edits code', () => {
    const copy = requestChangesCopy(line, 'final')
    expect(copy?.target).toBe('Build')
    expect(copy?.hint).toContain('reruns the stations after it')
  })

  it('is null when nothing comes before the gate', () => {
    expect(requestChangesCopy([gate('g', 'Gate'), ...line], 'g')).toBeNull()
    expect(requestChangesCopy(line, 'missing')).toBeNull()
  })
})
