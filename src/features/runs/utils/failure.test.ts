import { describe, expect, it } from 'vitest'

import { friendlyFailure, runFailure } from '@/features/runs/utils/failure'
import type { Run, RunEvent } from '@/lib/contracts'

let seq = 0
function event(
  type: RunEvent['type'],
  message: string,
  stationRunId: string | null = null,
): RunEvent {
  seq += 1
  return {
    id: crypto.randomUUID(),
    runId: crypto.randomUUID(),
    stationRunId,
    seq,
    type,
    message,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function run(status: Run['status']): Run {
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
    stations: [],
  }
}

describe('runFailure', () => {
  it('reads a delivery failure: title, safe branch, and the hook line from the earlier log', () => {
    const log = event(
      'error',
      'Delivery failed: Command failed: git commit -m x\n✔ lint: 2 files clean\n✖ commit-msg: subject must follow Conventional Commits',
    )
    const last = event(
      'error',
      'Delivery failed (work is safe on zastava/add-a-footer-note-0845df5e): Command failed: git commit -m x',
    )
    expect(runFailure(run('failed'), [log, last])).toMatchObject({
      kind: 'failed',
      title: 'Delivery failed',
      reason: '✖ commit-msg: subject must follow Conventional Commits',
      safeBranch: 'zastava/add-a-footer-note-0845df5e',
      eventId: last.id,
    })
  })

  it('takes the reason straight from the message when it has one', () => {
    const last = event(
      'error',
      'Delivery failed (work is safe on b): ✖ commit-msg: bad subject',
    )
    expect(runFailure(run('failed'), [last])?.reason).toBe('✖ commit-msg: bad subject')
  })

  it('flags a legacy succeeded run whose delivery failed', () => {
    const failed = event(
      'error',
      'Delivery failed: Command failed: git commit\n\u001B[38;2;0;0;0m╭──╮\u001B[0m\na.tsx:68:20: error shadcn(no-raw-colors): "bg-violet-50"',
    )
    expect(
      runFailure(run('succeeded'), [event('system', 'Workspace ready: x'), failed]),
    ).toMatchObject({
      title: 'Delivery failed',
      reason: 'a.tsx:68:20: error shadcn(no-raw-colors): "bg-violet-50"',
      safeBranch: null,
    })
  })

  it('leaves a delivered run alone', () => {
    const events = [
      event('error', 'Delivery failed: boom'),
      event('system', 'Committed on zastava/x'),
    ]
    expect(runFailure(run('succeeded'), events)).toBeNull()
    expect(runFailure(run('succeeded'), [])).toBeNull()
  })

  it('ignores station-level errors and plain failures read as "Failed"', () => {
    const station = event('error', 'Delivery failed: in a station', crypto.randomUUID())
    const last = event('error', 'Build station failed after 3 attempts')
    expect(runFailure(run('failed'), [station, last])).toMatchObject({
      title: 'Failed',
      reason: 'Build station failed after 3 attempts',
    })
  })

  it('gives rejected and cancelled runs a calm title, and nothing for running ones', () => {
    expect(runFailure(run('cancelled'), [])).toMatchObject({ title: 'Cancelled', reason: null })
    expect(runFailure(run('rejected'), [])?.title).toBe('Rejected')
    expect(runFailure(run('running'), [event('error', 'x')])).toBeNull()
  })
})

describe('friendlyFailure', () => {
  it('turns a max-turns error into the limit and what to do', () => {
    expect(
      friendlyFailure(
        'Activity task failed: Claude Code returned an error result: Reached maximum number of turns (60)',
      ),
    ).toBe("Ran out of turns (60). Raise the station's turn limit or split the work order.")
  })

  it('names the budget cap with its amount', () => {
    expect(
      friendlyFailure('Claude Code returned an error result: Reached maximum budget ($0.50)'),
    ).toBe('Hit the budget cap ($0.50).')
    expect(friendlyFailure('Activity task failed: error_max_budget_usd')).toBe(
      'Hit the budget cap.',
    )
  })

  it('strips the wrappers from an unknown cause', () => {
    expect(
      friendlyFailure(
        'Activity task failed: Claude Code returned an error result: API overloaded',
      ),
    ).toBe('API overloaded')
  })

  it('keeps delivery failures and plain messages as they are', () => {
    const delivery = 'Delivery failed (work is safe on zastava/x): ✖ commit-msg: bad subject'
    expect(friendlyFailure(delivery)).toBe(delivery)
    expect(friendlyFailure('Budget exhausted: $0.04 of $0.01 spent before Build')).toBe(
      'Budget exhausted: $0.04 of $0.01 spent before Build',
    )
  })

  it('shows the friendly reason on the banner and keeps the raw text in the detail', () => {
    const raw =
      'Activity task failed: Claude Code returned an error result: Reached maximum number of turns (60)'
    const failure = runFailure(run('failed'), [event('error', raw)])
    expect(failure?.reason).toBe(
      "Ran out of turns (60). Raise the station's turn limit or split the work order.",
    )
    expect(failure?.detail).toBe(raw)
  })
})
