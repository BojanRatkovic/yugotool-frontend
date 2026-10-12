import { describe, expect, it } from 'vitest'

import {
  cycleThread,
  nextUnviewed,
  parseLineKey,
  stepFile,
} from '@/features/pull-requests/utils/file-nav'

const order = ['a.ts', 'b.ts', 'c.ts']

describe('stepFile', () => {
  it('moves one file and stops at the ends', () => {
    expect(stepFile(order, 'a.ts', 1)).toBe('b.ts')
    expect(stepFile(order, 'a.ts', -1)).toBe('a.ts')
    expect(stepFile(order, 'c.ts', 1)).toBe('c.ts')
  })

  it('starts at the first file when none is selected or it is hidden', () => {
    expect(stepFile(order, undefined, 1)).toBe('a.ts')
    expect(stepFile(order, undefined, -1)).toBe('a.ts')
    expect(stepFile(order, 'collapsed/x.ts', 1)).toBe('a.ts')
  })

  it('is undefined without files', () => {
    expect(stepFile([], undefined, 1)).toBeUndefined()
  })
})

const files = (viewed: string[]) =>
  order.map((path) => ({ path, viewed: viewed.includes(path) }))

describe('nextUnviewed', () => {
  it('finds the next unviewed file after the current one, wrapping', () => {
    expect(nextUnviewed(order, 'a.ts', files(['b.ts']))).toBe('c.ts')
    expect(nextUnviewed(order, 'c.ts', files(['b.ts']))).toBe('a.ts')
  })

  it('skips the current file and is undefined when all others are viewed', () => {
    expect(nextUnviewed(order, 'b.ts', files(['a.ts', 'c.ts']))).toBeUndefined()
  })

  it('without a current file in order, looks at every file', () => {
    expect(nextUnviewed(order, undefined, files(['a.ts']))).toBe('b.ts')
  })
})

describe('cycleThread', () => {
  const threads = [
    { id: 't20', line: 20 },
    { id: 'tfile', line: null },
    { id: 't5', line: 5 },
  ]

  it('walks threads with a line in line order, wrapping both ways', () => {
    expect(cycleThread(threads, undefined, 1)).toBe('t5')
    expect(cycleThread(threads, 't5', 1)).toBe('t20')
    expect(cycleThread(threads, 't20', 1)).toBe('t5')
    expect(cycleThread(threads, 't5', -1)).toBe('t20')
    expect(cycleThread(threads, undefined, -1)).toBe('t5')
  })

  it('is undefined when no thread sits on a line', () => {
    expect(cycleThread([{ id: 'tfile', line: null }], undefined, 1)).toBeUndefined()
  })
})

describe('parseLineKey', () => {
  it('reads a side and a line', () => {
    expect(parseLineKey('RIGHT12')).toEqual({ side: 'RIGHT', line: 12 })
    expect(parseLineKey('LEFT3')).toEqual({ side: 'LEFT', line: 3 })
    expect(parseLineKey('MIDDLE3')).toBeNull()
  })
})
