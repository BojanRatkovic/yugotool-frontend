import { describe, expect, it } from 'vitest'

import { parseDelivery, parsePullRequest, pullRequestLabel, splitLinks } from '@/lib/links'

describe('parsePullRequest', () => {
  it('reads number and repo from a GitHub URL', () => {
    const pr = parsePullRequest('https://github.com/acme/storefront/pull/1145')
    expect(pr).toMatchObject({ number: 1145, repo: 'acme/storefront' })
    expect(pullRequestLabel(pr)).toBe('PR #1145')
    expect(pullRequestLabel(pr, 'Pull request')).toBe('Pull request #1145')
  })

  it('falls back when there is no number', () => {
    const pr = parsePullRequest('https://example.com/merge-requests/new')
    expect(pr).toMatchObject({ number: null, repo: null })
    expect(pullRequestLabel(pr)).toBe('Pull request')
  })
})

describe('splitLinks', () => {
  it('splits URLs out and leaves sentence punctuation as text', () => {
    expect(splitLinks('See https://github.com/a/b/pull/1. Done')).toEqual([
      { kind: 'text', value: 'See ' },
      { kind: 'link', value: 'https://github.com/a/b/pull/1' },
      { kind: 'text', value: '. Done' },
    ])
  })

  it('keeps URLs in parentheses intact without the closing paren', () => {
    expect(splitLinks('(https://x.dev/a?b=1)')).toEqual([
      { kind: 'text', value: '(' },
      { kind: 'link', value: 'https://x.dev/a?b=1' },
      { kind: 'text', value: ')' },
    ])
  })

  it('returns plain text unchanged', () => {
    expect(splitLinks('no links here')).toEqual([{ kind: 'text', value: 'no links here' }])
    expect(splitLinks('')).toEqual([])
  })
})

describe('parseDelivery', () => {
  it('recognises the three worker summaries', () => {
    expect(parseDelivery('Pull request opened: https://github.com/o/r/pull/7')).toMatchObject({
      kind: 'pull_request',
      pr: { number: 7, repo: 'o/r' },
    })
    expect(
      parseDelivery(
        'Pushed yugotool/x to origin (/tmp/origin.git); not a GitHub remote, so no PR.',
      ),
    ).toEqual({ kind: 'pushed', branch: 'yugotool/x', remote: '/tmp/origin.git' })
    expect(parseDelivery('Committed on yugotool/x (no origin remote, no PR).')).toEqual({
      kind: 'committed',
      branch: 'yugotool/x',
    })
    expect(parseDelivery('Session abc · started')).toBeNull()
  })
})
