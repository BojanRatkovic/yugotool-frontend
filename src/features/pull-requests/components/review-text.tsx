import { Fragment } from 'react'

import { cn } from '@/lib/utils'

/** `code` and **bold** inside a line; everything else stays plain text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={index} className="rounded-sm bg-muted px-1 font-mono text-[0.75rem]">
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
 * Review prose as ZASTAVA's reviewer writes it: paragraphs on blank lines,
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
