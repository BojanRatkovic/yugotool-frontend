import { Fragment } from 'react'

import { splitLinks } from '@/lib/links'
import { cn } from '@/lib/utils'

export const LINK_CLASS =
  'text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground break-all'

/** Plain text with every http(s) URL turned into a real link (new tab). */
export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {splitLinks(text).map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(LINK_CLASS, className)}
          >
            {part.value}
          </a>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </>
  )
}
