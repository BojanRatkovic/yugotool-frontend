import { describe, expect, it } from 'vitest'

import { gateRequest } from '@/features/runs/utils/gate-decision'

const base = {
  comment: '',
  delivery: undefined,
  canRequestChanges: true,
  repo: undefined,
} as const

describe('gateRequest', () => {
  it('approves with the delivery at the final gate', () => {
    expect(gateRequest({ ...base, decision: 'approve', delivery: 'draft_pr' })).toEqual({
      kind: 'send',
      delivery: 'draft_pr',
      body: { decision: 'approve', comment: '', delivery: 'draft_pr' },
    })
  })

  it('never sends a delivery or repo with reject or request changes', () => {
    expect(
      gateRequest({ ...base, decision: 'reject', delivery: 'pr', repo: 'web', comment: 'no' }),
    ).toEqual({
      kind: 'send',
      delivery: undefined,
      body: { decision: 'reject', comment: 'no' },
    })
    expect(
      gateRequest({ ...base, decision: 'request_changes', comment: 'fix', delivery: 'pr' }),
    ).toEqual({
      kind: 'send',
      delivery: undefined,
      body: { decision: 'request_changes', comment: 'fix' },
    })
  })

  it('asks for a comment before requesting changes', () => {
    expect(gateRequest({ ...base, decision: 'request_changes', comment: '  ' })).toEqual({
      kind: 'needs_comment',
    })
  })

  it('does nothing when there is no station to send the work back to', () => {
    expect(
      gateRequest({
        ...base,
        decision: 'request_changes',
        comment: 'x',
        canRequestChanges: false,
      }),
    ).toEqual({ kind: 'none' })
  })

  it('needs a repo to approve a hub plan gate, and sends the chosen one', () => {
    expect(gateRequest({ ...base, decision: 'approve', repo: null })).toEqual({
      kind: 'needs_repo',
    })
    expect(gateRequest({ ...base, decision: 'approve', repo: 'web' })).toEqual({
      kind: 'send',
      delivery: undefined,
      body: { decision: 'approve', comment: '', repo: 'web' },
    })
    // Reject at a plan gate needs no repo.
    expect(gateRequest({ ...base, decision: 'reject', repo: null }).kind).toBe('send')
  })
})
