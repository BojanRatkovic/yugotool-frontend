import { describe, expect, it } from 'vitest'

import { newStation } from '@/features/projects/utils/line-draft'
import { qaOffer, shouldOfferQa } from '@/features/projects/utils/offer-qa'
import { QA_STATION_TEMPLATE, type Station } from '@/lib/contracts'

function agent(key: string, name: string, canEdit: boolean): Station {
  const base = newStation('agent', [])
  if (base.kind !== 'agent') throw new Error('expected an agent station')
  return { ...base, key, name, canEdit }
}
const gate = (key: string, name: string): Station => ({ key, kind: 'gate', name, prompt: '' })

const line = [
  agent('research', 'Research', false),
  gate('plan', 'Approve plan'),
  agent('build', 'Build', true),
  agent('validate', 'Validate', false),
  gate('final', 'Final review'),
]

describe('qaOffer', () => {
  it('puts QA after the last station that edits code', () => {
    const offer = qaOffer(line)
    expect(offer?.after).toBe('Build')
    expect(offer?.stations.map((s) => s.key)).toEqual([
      'research',
      'plan',
      'build',
      'qa',
      'validate',
      'final',
    ])
  })

  it('offers nothing when the line has QA or nothing edits code', () => {
    expect(qaOffer([...line, QA_STATION_TEMPLATE])).toBeNull()
    expect(qaOffer([agent('research', 'Research', false), gate('final', 'Final')])).toBeNull()
  })
})

describe('shouldOfferQa', () => {
  it('needs a passing preview, a line that can take QA, and no dismissal', () => {
    expect(shouldOfferQa({ previewOk: true, stations: line, dismissed: false })).toBe(true)
    expect(shouldOfferQa({ previewOk: false, stations: line, dismissed: false })).toBe(false)
    expect(shouldOfferQa({ previewOk: true, stations: line, dismissed: true })).toBe(false)
    expect(shouldOfferQa({ previewOk: true, stations: undefined, dismissed: false })).toBe(
      false,
    )
    expect(
      shouldOfferQa({
        previewOk: true,
        stations: [...line, QA_STATION_TEMPLATE],
        dismissed: false,
      }),
    ).toBe(false)
  })
})
