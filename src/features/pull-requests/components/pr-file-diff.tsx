import { Copy, ExternalLink, Plus } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Tokens } from '@/components/code-block'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Textarea } from '@/components/ui/textarea'
import { useAddLineComment, useCommentNow } from '@/features/pull-requests/api/pr-mutations'
import { PrThread } from '@/features/pull-requests/components/pr-thread'
import { PrThreadActions } from '@/features/pull-requests/components/pr-thread-actions'
import { useHighlightedTokens } from '@/hooks/use-highlighter'
import { errorMessage } from '@/lib/api-client'
import { normalizeLang } from '@/lib/code-language'
import type { PrFile, PrThread as Thread, PullRequestDetail } from '@/lib/contracts'
import type { DiffFile, DiffLine } from '@/lib/diff'
import { IS_MAC } from '@/lib/shortcuts'
import { cn } from '@/lib/utils'

/** Past this many lines a single file isn't rendered here (GitHub has it). */
const MAX_FILE_LINES = 5_000

const ROW: Record<DiffLine['kind'], string> = {
  context: '',
  add: 'bg-status-passed-soft/70',
  del: 'bg-status-failed-soft/70',
  hunk: 'bg-status-running-soft/40 text-muted-foreground',
  meta: 'text-muted-foreground italic',
}

const SIGN: Record<DiffLine['kind'], string> = {
  context: ' ',
  add: '+',
  del: '-',
  hunk: '',
  meta: '',
}

export type Side = 'LEFT' | 'RIGHT'

/** Where a line comment goes: GitHub's line + side, optionally a range. */
export interface CommentTarget {
  side: Side
  line: number
  startLine?: number
}

/** A diff line's anchor on GitHub: deletions on the left, everything else on the right. */
export function lineAnchor(line: DiffLine): { side: Side; line: number } | null {
  if (line.kind === 'del' && line.oldNumber !== null)
    return { side: 'LEFT', line: line.oldNumber }
  if ((line.kind === 'add' || line.kind === 'context') && line.newNumber !== null) {
    return { side: 'RIGHT', line: line.newNumber }
  }
  return null
}

const anchorKey = (a: { side: Side; line: number }) => `${a.side}${a.line}`

const commentFailed = (error: unknown) =>
  toast.error(`Couldn't comment: ${errorMessage(error)}`)

function LineCommentForm({
  projectId,
  number,
  path,
  target,
  onDone,
}: {
  projectId: string
  number: number
  path: string
  target: CommentTarget
  onDone: () => void
}) {
  const [body, setBody] = useState('')
  const addToReview = useAddLineComment(projectId, number)
  const commentNow = useCommentNow(projectId, number)
  const busy = addToReview.isPending || commentNow.isPending
  const input = {
    path,
    line: target.line,
    side: target.side,
    ...(target.startLine === undefined
      ? {}
      : { startLine: target.startLine, startSide: target.side }),
    body,
  }
  const onError = commentFailed
  const textRef = useRef<HTMLTextAreaElement>(null)
  // The box opens on purpose (a click on +, or c): typing goes straight in.
  useEffect(() => textRef.current?.focus(), [])
  const add = () => {
    if (body.trim() === '' || busy) return
    addToReview.mutate(input, { onSuccess: onDone, onError })
  }
  const range =
    target.startLine === undefined
      ? `line ${target.line}`
      : `lines ${target.startLine}–${target.line}`
  return (
    <form
      className="flex flex-col gap-2 rounded-md border bg-card p-2 font-sans whitespace-normal"
      onSubmit={(event) => {
        event.preventDefault()
        add()
      }}
    >
      <label htmlFor={`line-comment-${path}`} className="text-xs text-muted-foreground">
        Comment on {range} ({target.side === 'LEFT' ? 'old' : 'new'})
      </label>
      <Textarea
        id={`line-comment-${path}`}
        ref={textRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onDone()
          } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            add()
          }
        }}
        placeholder="Leave a comment (markdown)"
        className="min-h-16 text-[0.8125rem]"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          <Kbd>{IS_MAC ? '⌘' : 'Ctrl'}</Kbd> <Kbd>↵</Kbd> adds to your review
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={body.trim() === '' || busy}
          onClick={() => commentNow.mutate(input, { onSuccess: onDone, onError })}
        >
          Comment now
        </Button>
        <Button type="submit" size="sm" disabled={body.trim() === '' || busy}>
          {addToReview.isPending ? 'Adding…' : 'Add to review'}
        </Button>
      </div>
    </form>
  )
}

function copyPath(path: string) {
  navigator.clipboard.writeText(path).then(
    () => toast.success('Path copied.'),
    () => toast.error("Couldn't copy to the clipboard."),
  )
}

/**
 * One file of the PR: sticky header (path, copy, viewed, GitHub), the unified
 * diff with line numbers and highlighting, review threads under the lines they
 * anchor to, and a comment box on any line (shift-click for a range).
 */
export function PrFileDiff({
  projectId,
  pr,
  file,
  diff,
  threads,
  focusedThread,
  focusedLine,
  commentTarget,
  onFocusLine,
  onComment,
  onViewed,
}: {
  projectId: string
  pr: PullRequestDetail
  file: PrFile
  /** The file's parsed patch; null when the diff has no hunk for it (too big for GitHub). */
  diff: DiffFile | null
  /** Threads on this file that aren't outdated. */
  threads: Thread[]
  focusedThread: string | undefined
  /** `RIGHT12`-style key of the line `c` comments on. */
  focusedLine: string | null
  commentTarget: CommentTarget | null
  onFocusLine: (key: string) => void
  onComment: (target: CommentTarget | null) => void
  onViewed: (viewed: boolean) => void
}) {
  const lines = useMemo(() => diff?.lines ?? [], [diff])
  // Hunk and meta rows aren't code: tokens are indexed over the code rows only.
  const { codeLines, codeIndexOf } = useMemo(() => {
    const code: string[] = []
    const indexOf: number[] = []
    for (const line of lines) {
      const isCode = line.kind !== 'hunk' && line.kind !== 'meta'
      indexOf.push(isCode ? code.length : -1)
      if (isCode) code.push(line.text)
    }
    return { codeLines: code, codeIndexOf: indexOf }
  }, [lines])
  const ext = file.path.includes('.') ? (file.path.split('.').at(-1) ?? '') : ''
  const tokens = useHighlightedTokens(codeLines.join('\n'), normalizeLang(ext))
  const threadsAt = useMemo(() => {
    const map = new Map<string, Thread[]>()
    for (const thread of threads) {
      if (thread.line === null) continue
      const key = anchorKey({ side: thread.side, line: thread.line })
      map.set(key, [...(map.get(key) ?? []), thread])
    }
    return map
  }, [threads])
  const [rangeStart, setRangeStart] = useState<{ side: Side; line: number } | null>(null)

  const tooLarge = diff === null || diff.binary || lines.length > MAX_FILE_LINES

  return (
    <section aria-label={file.path} className="flex min-h-0 flex-col">
      <header className="sticky top-0 z-[5] flex h-10 shrink-0 items-center gap-2 border-b bg-card px-3">
        <span className="min-w-0 truncate font-mono text-xs font-medium" title={file.path}>
          {file.path}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Copy path"
          onClick={() => copyPath(file.path)}
        >
          <Copy aria-hidden="true" />
        </Button>
        <span className="ml-auto flex shrink-0 gap-1.5 font-mono text-[0.6875rem] tabular-nums">
          <span className="text-status-passed">+{file.additions}</span>
          <span className="text-status-failed">−{file.deletions}</span>
        </span>
        <label className="flex shrink-0 items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={file.viewed}
            onChange={(event) => onViewed(event.target.checked)}
            className="size-3.5 accent-[var(--status-passed)]"
          />
          Viewed <Kbd className="h-4">V</Kbd>
        </label>
        <Button variant="ghost" size="icon-xs" asChild>
          <a
            href={`${pr.url}/files`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open on GitHub"
            title="Open on GitHub"
          >
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </header>
      {tooLarge ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {diff?.binary === true ? 'Binary file.' : 'Too large to show here.'}{' '}
          <a
            href={`${pr.url}/files`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View it on GitHub
          </a>
          .
        </p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-max min-w-full border-collapse font-mono text-[0.75rem] leading-5">
            <tbody>
              {lines.map((line, index) => {
                if (line.kind === 'hunk' || line.kind === 'meta') {
                  return (
                    <tr key={index} className={ROW[line.kind]}>
                      <td colSpan={5} className="px-3 py-0.5 whitespace-pre">
                        {line.text}
                      </td>
                    </tr>
                  )
                }
                const lineTokens = tokens?.[codeIndexOf[index] ?? -1]
                const anchor = lineAnchor(line)
                const key = anchor === null ? null : anchorKey(anchor)
                const lineThreads = key === null ? [] : (threadsAt.get(key) ?? [])
                const commenting =
                  commentTarget !== null &&
                  anchor !== null &&
                  commentTarget.side === anchor.side &&
                  commentTarget.line === anchor.line
                const inRange =
                  commentTarget?.startLine !== undefined &&
                  anchor !== null &&
                  anchor.side === commentTarget.side &&
                  anchor.line >= commentTarget.startLine &&
                  anchor.line <= commentTarget.line
                return (
                  <Fragment key={index}>
                    <tr
                      data-line={key ?? undefined}
                      className={cn(
                        'group/line',
                        ROW[line.kind],
                        (inRange || commenting) &&
                          'outline-1 -outline-offset-1 outline-ring/60',
                        key !== null && key === focusedLine && 'bg-accent/50',
                      )}
                    >
                      <td className="w-10 min-w-10 border-r px-2 text-right align-top text-muted-foreground/70 select-none">
                        {line.oldNumber ?? ''}
                      </td>
                      <td className="w-10 min-w-10 border-r px-2 text-right align-top text-muted-foreground/70 select-none">
                        {line.newNumber ?? ''}
                      </td>
                      <td className="w-5 min-w-5 align-top">
                        {anchor === null || key === null ? null : (
                          <button
                            type="button"
                            aria-label={`Comment on ${anchor.side === 'LEFT' ? 'old' : 'new'} line ${anchor.line}`}
                            onFocus={() => onFocusLine(key)}
                            onClick={(event) => {
                              onFocusLine(key)
                              if (
                                event.shiftKey &&
                                rangeStart !== null &&
                                rangeStart.side === anchor.side &&
                                rangeStart.line !== anchor.line
                              ) {
                                const [from, to] = [rangeStart.line, anchor.line].toSorted(
                                  (a, b) => a - b,
                                )
                                onComment({
                                  side: anchor.side,
                                  line: to ?? anchor.line,
                                  startLine: from,
                                })
                              } else {
                                setRangeStart(anchor)
                                onComment({ side: anchor.side, line: anchor.line })
                              }
                            }}
                            className="flex size-5 items-center justify-center rounded-sm bg-status-running text-background opacity-0 group-hover/line:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <Plus aria-hidden="true" className="size-3" />
                          </button>
                        )}
                      </td>
                      <td
                        className={cn(
                          'w-5 min-w-5 text-center align-top select-none',
                          line.kind === 'add' && 'text-status-passed',
                          line.kind === 'del' && 'text-status-failed',
                        )}
                      >
                        {SIGN[line.kind]}
                      </td>
                      <td className="pr-4 whitespace-pre">
                        {line.text === '' ? (
                          ' '
                        ) : lineTokens === undefined ? (
                          line.text
                        ) : (
                          <Tokens tokens={lineTokens} />
                        )}
                      </td>
                    </tr>
                    {lineThreads.length === 0 && !commenting ? null : (
                      <tr>
                        <td colSpan={5} className="border-y bg-background px-3 py-2">
                          <div className="flex max-w-3xl flex-col gap-2">
                            {lineThreads.map((thread) => (
                              <PrThread
                                key={thread.id}
                                thread={thread}
                                focused={thread.id === focusedThread}
                                actions={
                                  <PrThreadActions
                                    projectId={projectId}
                                    number={pr.number}
                                    thread={thread}
                                  />
                                }
                              />
                            ))}
                            {commenting && commentTarget !== null ? (
                              <LineCommentForm
                                projectId={projectId}
                                number={pr.number}
                                path={file.path}
                                target={commentTarget}
                                onDone={() => {
                                  setRangeStart(null)
                                  onComment(null)
                                }}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
