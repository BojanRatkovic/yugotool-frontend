import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { HighlighterCore, ThemedToken } from 'shiki/core'

import type { CodeLang } from '@/lib/code-language'

/** Past this, highlighting costs more than it helps — the block stays plain. */
const MAX_HIGHLIGHT_CHARS = 60_000

let highlighter: HighlighterCore | null = null
let loading: Promise<void> | null = null
let theme = ''
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return highlighter
}

/** Loads Shiki once (its own chunk); every subscribed block re-renders when it lands. */
function loadHighlighter(): Promise<void> {
  loading ??= import('@/lib/shiki')
    .then(async (module) => {
      highlighter = await module.createHighlighter()
      theme = module.THEME
      for (const listener of listeners) listener()
      return undefined
    })
    .catch(() => {
      // Highlighting is decoration: on failure the plain text simply stays.
    })
  return loading
}

// Same text + language → same tokens, so collapsing/expanding a group doesn't re-tokenize.
const cache = new Map<string, ThemedToken[][]>()
const CACHE_LIMIT = 300

function tokenize(
  instance: HighlighterCore,
  code: string,
  lang: CodeLang,
): ThemedToken[][] | null {
  const key = `${lang}\u0000${code}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  try {
    const tokens = instance.codeToTokensBase(code, { lang, theme })
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, tokens)
    return tokens
  } catch {
    return null
  }
}

/**
 * Highlighted tokens per line, or null until Shiki has loaded (render the
 * plain text meanwhile — same lines, so nothing moves when it swaps in).
 */
export function useHighlightedTokens(
  code: string,
  lang: CodeLang | null,
): ThemedToken[][] | null {
  const instance = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const enabled = lang !== null && code.length <= MAX_HIGHLIGHT_CHARS
  useEffect(() => {
    if (enabled) void loadHighlighter()
  }, [enabled])
  return useMemo(
    () =>
      instance === null || !enabled || lang === null ? null : tokenize(instance, code, lang),
    [instance, enabled, code, lang],
  )
}
