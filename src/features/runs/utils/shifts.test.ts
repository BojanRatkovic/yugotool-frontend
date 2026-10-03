import { describe, expect, it } from 'vitest'

import {
  contextPct,
  draftToHandoff,
  formatPct,
  gaugeFill,
  handoffToDraft,
  linesToList,
  liveShift,
  shiftSummary,
  taskProgress,
} from '@/features/runs/utils/shifts'
import type { Handoff, Shift } from '@/lib/contracts'

describe('context math', () => {
  it('is a percent of the window, null without one', () => {
    expect(contextPct(50_000, 200_000)).toBe(25)
    expect(contextPct(50_000, null)).toBeNull()
    expect(contextPct(50_000, 0)).toBeNull()
  })

  it('clamps the gauge fill to 0–100', () => {
    expect(gaugeFill(250_000, 200_000)).toBe(100)
    expect(gaugeFill(-1, 200_000)).toBe(0)
    expect(gaugeFill(10, null)).toBe(0)
    expect(gaugeFill(76_000, 200_000)).toBe(38)
  })

  it('formats whole percents', () => {
    expect(formatPct(37.6)).toBe('38%')
    expect(formatPct(null)).toBe('—')
  })
})

describe('shiftSummary', () => {
  const base = { contextTokens: 76_000, contextWindow: 200_000 }

  it('shows shift, tasks and live context', () => {
    expect(
      shiftSummary({
        ...base,
        shift: { number: 4, status: 'running', tasksDone: 7, tasksTotal: 12 },
      }),
    ).toBe('Shift 4 · 7/12 tasks · 38%')
  })

  it('drops tasks before tasks.json exists and context once the shift ended', () => {
    expect(
      shiftSummary({
        ...base,
        shift: { number: 1, status: 'done', tasksDone: 0, tasksTotal: 0 },
      }),
    ).toBe('Shift 1')
  })

  it('is null for other station kinds', () => {
    expect(shiftSummary({ ...base, shift: null })).toBeNull()
  })
})

describe('taskProgress', () => {
  it('counts done tasks', () => {
    expect(
      taskProgress([
        { status: 'done' },
        { status: 'doing' },
        { status: 'todo' },
        { status: 'done' },
      ]),
    ).toEqual({
      done: 2,
      total: 4,
      pct: 50,
    })
    expect(taskProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

describe('handoff drafts', () => {
  const handoff: Handoff = {
    summary: 'Half the operations are in.',
    done: ['add', 'subtract'],
    inProgress: null,
    nextSteps: ['multiply', 'divide'],
    gotchas: [],
    filesToRead: ['src/calc.js'],
  }

  it('round-trips through the editable form', () => {
    expect(draftToHandoff(handoffToDraft(handoff))).toEqual(handoff)
  })

  it('trims, drops blank lines and empties in-progress to null', () => {
    const draft = { ...handoffToDraft(handoff), done: ' add \n\n  mod\n', inProgress: '  ' }
    expect(draftToHandoff(draft)).toMatchObject({ done: ['add', 'mod'], inProgress: null })
    expect(linesToList('\n \n')).toEqual([])
  })
})

function shift(number: number, status: Shift['status']): Shift {
  return {
    id: crypto.randomUUID(),
    stationRunId: crypto.randomUUID(),
    stationKey: 'build',
    number,
    status,
    sessionId: null,
    contextTokens: 0,
    contextWindow: 200_000,
    handoffAtPct: 50,
    costUsd: 0,
    numTurns: 0,
    commits: 0,
    tasksDone: 0,
    tasksTotal: 0,
    handoff: null,
    endReason: null,
    handoffRequested: false,
    stopAfter: false,
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: null,
  }
}

describe('liveShift', () => {
  it('picks the running or handing-off shift', () => {
    expect(liveShift([shift(1, 'done'), shift(2, 'handing_off')])?.number).toBe(2)
    expect(liveShift([shift(1, 'done'), shift(2, 'awaiting_review')])).toBeUndefined()
  })
})
