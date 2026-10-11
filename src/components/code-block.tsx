import { useRef, type CSSProperties } from 'react'
import type { ThemedToken } from 'shiki/core'

import { CopyButton } from '@/components/copy-button'
import { LinkifiedText } from '@/components/linkified-text'
import { useHighlightedTokens } from '@/hooks/use-highlighter'
import { useSeen } from '@/hooks/use-seen'
import { stripAnsi, type CodeLang } from '@/lib/code-language'
import { cn } from '@/lib/utils'

// Shiki's FontStyle bit flags (kept local so `shiki` stays out of the main chunk).
const ITALIC = 1
const UNDERLINE = 4

function tokenStyle(token: ThemedToken): CSSProperties {
  const fontStyle = token.fontStyle ?? 0
  return {
    color: token.color,
    backgroundColor: token.bgColor,
    // No bold: it would change nothing in width but adds noise to dense logs.
    fontStyle: fontStyle & ITALIC ? 'italic' : undefined,
    textDecoration: fontStyle & UNDERLINE ? 'underline' : undefined,
  }
}

/** What a one-line `CodeLine` highlights and what its tooltip shows. */
const LINE_CHARS = 300
const TITLE_CHARS = 1_000

/** Unified-diff line → its row tint. */
function diffLineClass(line: string): string | undefined {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-muted-foreground'
  if (line.startsWith('+')) return 'bg-status-passed-soft/70'
  if (line.startsWith('-')) return 'bg-status-failed-soft/70'
  if (line.startsWith('@@')) return 'bg-muted/60'
  return undefined
}

/** Shiki tokens as styled spans (diff and code views). */
export function Tokens({ tokens }: { tokens: ThemedToken[] }) {
  return tokens.map((token, index) => (
    <span key={index} style={tokenStyle(token)}>
      {token.content}
    </span>
  ))
}

/**
 * A read-only code/output block: plain text first, Shiki tokens once the
 * lazy highlighter lands — same lines, font and padding, so nothing moves.
 * Lines are blocks so diff tints span the full scroll width.
 */
export function CodeBlock({
  code,
  lang,
  className,
  copyLabel = 'Copy',
}: {
  code: string
  lang: CodeLang | null
  /** Overrides for the scroll box (e.g. a different max height). */
  className?: string
  /** Null hides the copy button. */
  copyLabel?: string | null
}) {
  const text = lang === 'ansi' ? stripAnsi(code) : code
  const tokens = useHighlightedTokens(code, lang)
  const lines = text.split('\n')
  return (
    <div className="group/code relative min-w-0">
      <pre
        data-lang={lang ?? undefined}
        className={cn(
          'code-block max-h-48 scrollbar-thin overflow-auto rounded-md border bg-muted/40 py-2 font-mono text-[0.75rem] leading-relaxed whitespace-pre',
          lang === null || lang === 'ansi'
            ? 'text-muted-foreground'
            : 'text-(--shiki-foreground)',
          className,
        )}
      >
        <code className="inline-block min-w-full">
          {lines.map((line, index) => (
            <span
              key={index}
              className={cn(
                'block min-h-[1lh] px-2.5',
                lang === 'diff' ? diffLineClass(line) : undefined,
              )}
            >
              {tokens?.[index] !== undefined ? (
                <Tokens tokens={tokens[index]} />
              ) : lang === null ? (
                <LinkifiedText text={line} />
              ) : (
                line
              )}
            </span>
          ))}
        </code>
      </pre>
      {copyLabel === null ? null : (
        <CopyButton
          value={text}
          label={copyLabel}
          className="absolute top-1 right-1 bg-card/90 text-muted-foreground opacity-0 shadow-xs transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  )
}

/**
 * One line of code inline (a shell command in a tool row), highlighted once
 * it nears the screen: a long log doesn't tokenize hundreds of rows on open.
 */
export function CodeLine({
  code,
  lang,
  className,
}: {
  code: string
  lang: CodeLang
  className?: string
}) {
  // One truncated line shows a few hundred characters at most: highlighting a
  // whole heredoc (`cat > file <<EOF …`) cost hundreds of spans per row.
  const shown = code.length > LINE_CHARS ? code.slice(0, LINE_CHARS) : code
  const ref = useRef<HTMLSpanElement>(null)
  const tokens = useHighlightedTokens(shown, useSeen(ref) ? lang : null)
  const first = tokens?.[0]
  return (
    <span
      ref={ref}
      className={cn('text-(--shiki-foreground)', className)}
      title={code.length > TITLE_CHARS ? `${code.slice(0, TITLE_CHARS)}…` : code}
    >
      {first === undefined || tokens?.length !== 1 ? shown : <Tokens tokens={first} />}
    </span>
  )
}
