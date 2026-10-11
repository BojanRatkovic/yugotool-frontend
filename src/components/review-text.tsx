import { Fragment } from 'react'

import { cn } from '@/lib/utils'

/** `code` and **bold** inside a line; everything else stays plain text. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code
              key={index}
              className="rounded-sm border border-border/60 bg-muted px-1 py-px font-mono text-[0.75rem] text-foreground"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={index} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <Fragment key={index}>{part}</Fragment>
      })}
    </>
  )
}

/**
 * Review prose as YugoTool's reviewer writes it: paragraphs on blank lines,
 * `- ` bullets, fenced code, inline `code` and **bold**. Not a full markdown
 * renderer; enough that a summary isn't one wall of text.
 */
export function ReviewText({ text, className }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = []
  const lines = text.trim().split('\n')
  let paragraph: string[] = []
  let bullets: string[] = []
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(
        <p key={blocks.length}>
          <Inline text={paragraph.join(' ')} />
        </p>,
      )
      paragraph = []
    }
    if (bullets.length > 0) {
      blocks.push(
        <ul key={blocks.length} className="flex list-disc flex-col gap-1 pl-5">
          {bullets.map((bullet, index) => (
            <li key={index}>
              <Inline text={bullet} />
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim().startsWith('```')) {
      flush()
      const code: string[] = []
      for (i += 1; i < lines.length && !(lines[i] ?? '').trim().startsWith('```'); i++) {
        code.push(lines[i] ?? '')
      }
      blocks.push(
        <pre
          key={blocks.length}
          className="overflow-x-auto rounded-sm bg-muted px-2 py-1 font-mono text-xs"
        >
          {code.join('\n')}
        </pre>,
      )
    } else if (/^\s*[-*] /.test(line)) {
      if (paragraph.length > 0) flush()
      bullets.push(line.replace(/^\s*[-*] /, ''))
    } else if (line.trim() === '') {
      flush()
    } else if (bullets.length > 0 && /^\s{2,}\S/.test(line)) {
      // A wrapped bullet continues the bullet.
      bullets[bullets.length - 1] += ` ${line.trim()}`
    } else {
      if (bullets.length > 0) flush()
      paragraph.push(line.trim())
    }
  }
  flush()
  return <div className={cn('flex flex-col gap-2 leading-5', className)}>{blocks}</div>
}

/**
 * The first sentence of a finding and the rest, so the claim reads as a
 * headline. Pure. Never splits inside `code` (`e.g. foo.ts`); one sentence
 * comes back whole.
 */
export function leadSentence(text: string): [string, string] {
  const trimmed = text.trim()
  let inCode = false
  for (let i = 0; i < trimmed.length - 1; i++) {
    const char = trimmed.charAt(i)
    if (char === '`') inCode = !inCode
    else if (!inCode && '.!?'.includes(char) && /\s/.test(trimmed.charAt(i + 1))) {
      return [trimmed.slice(0, i + 1), trimmed.slice(i + 1).trim()]
    }
  }
  return [trimmed, '']
}
