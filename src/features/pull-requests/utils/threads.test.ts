import { describe, expect, it } from 'vitest'

import {
  filterThreads,
  hunkTail,
  pendingComments,
  waitsOnMe,
} from '@/features/pull-requests/utils/threads'
import type { PrThread } from '@/lib/contracts'
import { prActor, prDetail } from '@/testing/pull-request-fixtures'

function thread(id: string, logins: string[], patch: Partial<PrThread> = {}): PrThread {
  return {
    id,
    isResolved: false,
    isOutdated: false,
    path: 'src/a.ts',
    line: 3,
    startLine: null,
    side: 'RIGHT',
    diffHunk: '@@ -1,3 +1,4 @@\n a\n b\n+c\n d',
    viewerCanResolve: true,
    viewerCanReply: true,
    comments: logins.map((login, i) => ({
      id: `${id}-${i}`,
      author: prActor(login),
      bodyHtml: `<p>${login} says\nmore</p>`,
      createdAt: '2026-10-03T10:00:00Z',
      isPending: false,
    })),
    ...patch,
  }
}

describe('waitsOnMe', () => {
  it('counts unresolved threads whose last word isn’t mine, on my PR or threads I started', () => {
    const mine = prDetail({ author: prActor('me') })
    const theirs = prDetail({ author: prActor('ana') })
    expect(waitsOnMe(thread('t', ['ana']), mine, 'me')).toBe(true)
    expect(waitsOnMe(thread('t', ['ana', 'me']), mine, 'me')).toBe(false)
    expect(waitsOnMe(thread('t', ['ana'], { isResolved: true }), mine, 'me')).toBe(false)
    expect(waitsOnMe(thread('t', ['ana']), theirs, 'me')).toBe(false)
    expect(waitsOnMe(thread('t', ['me', 'ana']), theirs, 'me')).toBe(true)
  })
})

describe('filterThreads', () => {
  it('filters by state', () => {
    const pr = prDetail()
    const threads = [
      thread('a', ['ana']),
      thread('b', ['ana'], { isResolved: true }),
      thread('c', ['ana', 'me']),
    ]
    expect(filterThreads(threads, 'waiting', pr, 'me').map((t) => t.id)).toEqual(['a'])
    expect(filterThreads(threads, 'unresolved', pr, 'me').map((t) => t.id)).toEqual(['a', 'c'])
    expect(filterThreads(threads, 'resolved', pr, 'me').map((t) => t.id)).toEqual(['b'])
    expect(filterThreads(threads, 'all', pr, 'me')).toHaveLength(3)
  })
})

describe('hunkTail', () => {
  it('keeps the last lines without the hunk header', () => {
    expect(hunkTail('@@ -1 +1 @@\n a\n b\n+c', 2)).toEqual([' b', '+c'])
  })
})

describe('pendingComments', () => {
  it('lists my pending comments with where and the first line', () => {
    const pending = thread('p', ['me'])
    const comment = pending.comments[0]
    if (comment !== undefined) comment.isPending = true
    expect(
      pendingComments(prDetail({ reviewThreads: [pending, thread('x', ['ana'])] })),
    ).toEqual([{ id: 'p-0', where: 'src/a.ts:3', text: 'me says' }])
  })
})
