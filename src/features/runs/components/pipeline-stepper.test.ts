import { describe, expect, it } from 'vitest'

import { modelLabel } from '@/components/model-select'
import { detailLine } from '@/features/runs/components/pipeline-stepper'
import type { Station } from '@/lib/contracts'

const build: Station = {
  key: 'build',
  kind: 'agent',
  name: 'Build',
  role: 'builder',
  model: 'claude-opus-4-6',
  effort: 'high',
  allowedTools: [],
  canEdit: true,
  prompt: '',
}

describe('detailLine', () => {
  it("shows the line's model and effort without overrides", () => {
    expect(detailLine(build, undefined)).toBe(`${modelLabel('claude-opus-4-6')} · high`)
  })

  it("shows the work order's overrides, the way the run uses them", () => {
    expect(detailLine(build, undefined, { model: 'claude-haiku-4-5', effort: 'low' })).toBe(
      `${modelLabel('claude-haiku-4-5')} · low`,
    )
  })
})
