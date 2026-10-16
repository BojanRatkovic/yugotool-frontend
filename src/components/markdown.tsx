import { isValidElement, memo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { CodeBlock } from '@/components/code-block'
import { LINK_CLASS } from '@/components/linkified-text'
import { detectLanguage, normalizeLang } from '@/lib/code-language'
import { cn } from '@/lib/utils'

/** Running text stays at a readable measure; tables and code may use the full width. */
const MEASURE = 'max-w-[72ch]'

/** The text of a fenced block's `<code>` child, and its ```lang tag. */
function fencedCode(children: ReactNode): { code: string; tag: string } | null {
  if (!isValidElement<{ className?: string; children?: ReactNode }>(children)) return null
  const { className, children: body } = children.props
  const tag = /language-([\w+#.-]+)/.exec(className ?? '')?.[1] ?? ''
  // A fence's body is a single text node.
  const code = typeof body === 'string' ? body : ''
  return { code: code.replace(/\n$/, ''), tag }
}

const COMPONENTS: Components = {
  p: ({ children }) => <p className={MEASURE}>{children}</p>,
  h1: ({ children }) => (
    <h3 className={cn(MEASURE, 'pt-1 text-sm font-semibold')}>{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className={cn(MEASURE, 'pt-1 text-sm font-semibold')}>{children}</h3>
  ),
  h3: ({ children }) => <h4 className={cn(MEASURE, 'pt-1 font-semibold')}>{children}</h4>,
  h4: ({ children }) => <h5 className={cn(MEASURE, 'font-semibold')}>{children}</h5>,
  h5: ({ children }) => <h6 className={cn(MEASURE, 'font-semibold')}>{children}</h6>,
  h6: ({ children }) => <h6 className={cn(MEASURE, 'font-semibold')}>{children}</h6>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul
      className={cn(MEASURE, 'flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground')}
    >
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className={cn(
        MEASURE,
        'flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground marker:tabular-nums',
      )}
    >
      {children}
    </ol>
  ),
  // Nested lists and multi-paragraph items keep the same rhythm as the page.
  li: ({ children }) => <li className="pl-0.5 [&>ol]:mt-1 [&>ul]:mt-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote
      className={cn(MEASURE, 'flex flex-col gap-2 border-l-2 pl-3 text-muted-foreground')}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {children}
    </a>
  ),
  // Remote images in agent output are not fetched; the link is enough.
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      <a href={src} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {alt === undefined || alt === '' ? src : alt}
      </a>
    ) : null,
  // Inline code; fenced blocks are rendered whole by `pre` below.
  code: ({ children }) => (
    <code className="rounded-sm bg-muted box-decoration-clone px-1 py-px font-mono text-[0.75rem] [overflow-wrap:anywhere]">
      {children}
    </code>
  ),
  pre: ({ children }) => {
    const fenced = fencedCode(children)
    if (fenced === null) return <pre>{children}</pre>
    return (
      <CodeBlock
        code={fenced.code}
        lang={fenced.tag === '' ? detectLanguage(fenced.code) : normalizeLang(fenced.tag)}
        className="max-h-80"
      />
    )
  },
  table: ({ children }) => (
    <div className="w-full min-w-0 scrollbar-thin overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-left text-[0.75rem] leading-normal">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tr: ({ children }) => <tr className="border-b last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th
      style={style}
      className="border-b px-2.5 py-1.5 align-bottom font-medium whitespace-nowrap text-muted-foreground"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="min-w-24 px-2.5 py-1.5 align-top tabular-nums">
      {children}
    </td>
  ),
}

/** Long-form reading: real heading sizes and a separator under the top level. */
const READER_COMPONENTS: Components = {
  ...COMPONENTS,
  h1: ({ children }) => (
    <h2 className={cn(MEASURE, 'border-b pt-3 pb-1.5 text-lg font-semibold')}>{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className={cn(MEASURE, 'border-b pt-3 pb-1.5 text-base font-semibold')}>{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className={cn(MEASURE, 'pt-2 text-[0.9375rem] font-semibold')}>{children}</h4>
  ),
}

const REMARK_PLUGINS = [remarkGfm]

/**
 * Agent-written markdown (GitHub flavour: tables, task lists, autolinks) in
 * the app's type. Raw HTML is shown as text, never rendered.
 */
export const Markdown = memo(function Markdown({
  text,
  className,
  variant = 'compact',
}: {
  text: string
  className?: string
  /** `reader`: larger type and headings, for reading a whole plan or report. */
  variant?: 'compact' | 'reader'
}) {
  const reader = variant === 'reader'
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col text-foreground/90',
        reader ? 'gap-3.5 text-sm leading-7' : 'gap-2.5 text-[0.8125rem] leading-relaxed',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={reader ? READER_COMPONENTS : COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
