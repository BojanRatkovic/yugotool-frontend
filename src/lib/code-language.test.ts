import { describe, expect, it } from 'vitest'

import { detectLanguage, normalizeLang, stripAnsi } from '@/lib/code-language'

describe('normalizeLang', () => {
  it('maps fence tags and aliases to bundled languages', () => {
    expect(normalizeLang('ts')).toBe('typescript')
    expect(normalizeLang('Bash')).toBe('shellscript')
    expect(normalizeLang('yml')).toBe('yaml')
    expect(normalizeLang('jsx')).toBe('tsx')
    expect(normalizeLang('patch')).toBe('diff')
  })

  it('returns null for languages it does not bundle', () => {
    expect(normalizeLang('rust')).toBeNull()
    expect(normalizeLang('')).toBeNull()
  })
})

describe('detectLanguage', () => {
  it('detects a unified diff', () => {
    const diff = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,2 +1,2 @@\n-a\n+b'
    expect(detectLanguage(diff)).toBe('diff')
  })

  it('detects JSON, including truncated payloads', () => {
    expect(detectLanguage('{"verdict":"pass","n":2}')).toBe('json')
    expect(detectLanguage('[1, 2]')).toBe('json')
    expect(detectLanguage('{"screens":[{"name":"Home","path"')).toBe('json')
  })

  it('does not take prefixed log lines for JSON', () => {
    expect(detectLanguage('[pr] $ node server.js 49425\n[pr] ready')).toBeNull()
  })

  it('detects shell transcripts and terminal colours', () => {
    expect(detectLanguage('$ npm test\nok')).toBe('shellscript')
    expect(detectLanguage('[pr] \u001B[2m8:47 AM\u001B[22m ready')).toBe('ansi')
  })

  it('leaves plain text alone', () => {
    expect(detectLanguage('Workspace ready')).toBeNull()
    expect(detectLanguage('- About (/about.html): pinned')).toBeNull()
  })
})

describe('stripAnsi', () => {
  it('removes colour codes', () => {
    expect(stripAnsi('\u001B[33m\u001B[1m[vite]\u001B[22m\u001B[39m up')).toBe('[vite] up')
  })
})
