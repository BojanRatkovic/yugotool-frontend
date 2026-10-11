import { useQuery } from '@tanstack/react-query'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { FileDiff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { LoadError } from '@/components/data-state'
import { Skeleton } from '@/components/ui/skeleton'
import { runQueries } from '@/features/runs/api/run-queries'
import {
  diffRows,
  fileRowAt,
  ROW_HEIGHT,
  type DiffRow,
} from '@/features/runs/components/diff-rows'
import type { DiffLine } from '@/lib/diff'
import type { DiffFile, Run, RunDiff as RunDiffData } from '@/lib/contracts'
import { cn } from '@/lib/utils'

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

function Counts({ file }: { file: DiffFile }) {
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-[0.6875rem] tabular-nums">
      <span className="text-status-passed">+{file.additions}</span>
      <span className="text-status-failed">−{file.deletions}</span>
    </span>
  )
}

/** The file name first, its folder after it and dimmed: the name is what gets cut last. */
function FileName({ path }: { path: string }) {
  const slash = path.lastIndexOf('/')
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-1.5 font-mono text-xs">
      <span className="max-w-full shrink-0 truncate">{path.slice(slash + 1)}</span>
      {slash > 0 ? (
        <span className="min-w-0 truncate text-[0.6875rem] text-muted-foreground">
          {path.slice(0, slash)}
        </span>
      ) : null}
    </span>
  )
}

/** Header of a file in the patch; it stays put while the patch scrolls sideways. */
function FileHeader({ file, width }: { file: DiffFile; width: string }) {
  return (
    <div
      style={{ width }}
      className="sticky left-0 flex h-9 items-center gap-2 border-b bg-card px-3 font-sans"
    >
      <FileDiff aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate font-mono text-xs font-medium">
        {file.oldPath === null ? file.path : `${file.oldPath} → ${file.path}`}
      </span>
      {file.status === 'added' || file.status === 'deleted' ? (
        <span className="rounded-sm bg-muted px-1 text-[0.6875rem] text-muted-foreground">
          {file.status === 'added' ? 'New' : 'Deleted'}
        </span>
      ) : null}
      <span className="ml-auto">
        <Counts file={file} />
      </span>
    </div>
  )
}

function LineRow({ line }: { line: DiffLine }) {
  if (line.kind === 'hunk') {
    return <div className={cn('h-5 px-3 whitespace-pre', ROW.hunk)}>{line.text}</div>
  }
  return (
    <div className={cn('flex h-5', ROW[line.kind])}>
      <span className="w-10 shrink-0 border-r px-2 text-right text-muted-foreground/70 select-none">
        {line.oldNumber ?? ''}
      </span>
      <span className="w-10 shrink-0 border-r px-2 text-right text-muted-foreground/70 select-none">
        {line.newNumber ?? ''}
      </span>
      <span
        className={cn(
          'w-5 shrink-0 text-center select-none',
          line.kind === 'add' && 'text-status-passed',
          line.kind === 'del' && 'text-status-failed',
        )}
      >
        {SIGN[line.kind]}
      </span>
      <span className="pr-4 whitespace-pre">{line.text === '' ? ' ' : line.text}</span>
    </div>
  )
}

function Row({ row, width }: { row: DiffRow; width: string }) {
  if (row.kind === 'file') return <FileHeader file={row.file} width={width} />
  if (row.kind === 'line') return <LineRow line={row.line} />
  return (
    <p
      style={{ width }}
      className="sticky left-0 flex h-8 items-center border-b px-3 font-sans text-xs text-muted-foreground"
    >
      {row.text}
    </p>
  )
}

/** Width of an element, kept current: the patch's headers span the visible width only. */
function useWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0))
    if (element !== null) observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return width
}

function DiffView({ diff }: { diff: RunDiffData }) {
  const { files, truncated } = diff
  const { rows, fileRows, maxChars } = useMemo(
    () => diffRows(diff.files, diff.patch, diff.truncated),
    [diff],
  )
  const [patchElement, setPatchElement] = useState<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const viewport = useWidth(patchElement)
  const stickyRow = useRef(0)

  // oxlint-disable-next-line react/incompatible-library -- no React Compiler here; the virtualizer re-renders on scroll
  const patch = useVirtualizer({
    count: rows.length,
    getScrollElement: () => patchElement,
    estimateSize: (index) => ROW_HEIGHT[rows[index]?.kind ?? 'line'],
    overscan: 30,
    // The current file's header is always rendered, pinned to the top (sticky).
    rangeExtractor: (range) => {
      stickyRow.current = fileRowAt(fileRows, range.startIndex)
      const indexes = new Set([stickyRow.current, ...defaultRangeExtractor(range)])
      return [...indexes].toSorted((a, b) => a - b)
    },
  })
  const list = useVirtualizer({
    count: files.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 28,
    overscan: 20,
    paddingStart: 8,
    paddingEnd: 8,
  })

  // Read before rendering the list: the range extractor sets the current file.
  const patchItems = patch.getVirtualItems()
  const currentFile = fileRows.indexOf(stickyRow.current)
  const additions = files.reduce((sum, file) => sum + file.additions, 0)
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0)

  return (
    // Fills the panel's scroll area so the file list and the patch scroll independently.
    <div className="absolute inset-0 grid grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Changed files" className="flex min-h-0 flex-col border-r">
        {/* Same 36px band as the patch's file header, so both columns start on one line. */}
        <p className="flex h-9 shrink-0 items-center justify-between border-b px-4 text-xs text-muted-foreground">
          <span>
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="flex gap-1.5 font-mono text-[0.6875rem] tabular-nums">
            <span className="text-status-passed">+{additions}</span>
            <span className="text-status-failed">−{deletions}</span>
          </span>
        </p>
        <div
          ref={listRef}
          data-testid="diff-file-list"
          className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto px-2"
        >
          <ul className="relative" style={{ height: list.getTotalSize() }}>
            {list.getVirtualItems().map((item) => {
              const file = files[item.index]
              if (file === undefined) return null
              return (
                <li
                  key={item.key}
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      patch.scrollToIndex(fileRows[item.index] ?? 0, { align: 'start' })
                    }
                    aria-current={item.index === currentFile ? 'location' : undefined}
                    className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-accent aria-[current]:bg-accent/60"
                    title={file.path}
                  >
                    <FileName path={file.path} />
                    <Counts file={file} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        {truncated ? (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            The patch passed its size cap; the last files are listed without lines.
          </p>
        ) : null}
      </nav>
      <div
        ref={setPatchElement}
        data-testid="diff-patch"
        className="relative min-h-0 min-w-0 scrollbar-thin overflow-auto"
      >
        <div
          className="relative font-mono text-[0.75rem] leading-5"
          // The longest line sets the scroll width: rows outside the window are not rendered.
          style={{
            height: patch.getTotalSize(),
            width: `max(100%, calc(${maxChars}ch + 8.25rem))`,
          }}
        >
          {patchItems.map((item) => {
            const row = rows[item.index]
            if (row === undefined) return null
            const sticky = item.index === stickyRow.current
            return (
              <div
                key={item.key}
                className={cn('inset-x-0 top-0', sticky ? 'sticky z-[5] bg-card' : 'absolute')}
                style={sticky ? undefined : { transform: `translateY(${item.start}px)` }}
              >
                <Row row={row} width={viewport > 0 ? `${viewport}px` : '100%'} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Worktree diff against the base branch: every changed file, and the patch
 * with line numbers. Both are virtualized, so a diff of any size stays whole.
 */
export function RunDiff({ run }: { run: Run }) {
  // A hub run plans in the hub first; its repo's worktree comes after the plan gate (spec 0014).
  const noWorktreeYet =
    run.worktreePath === null &&
    (run.status === 'running' || run.status === 'awaiting_approval')
  const diff = useQuery({ ...runQueries.diff(run.id), enabled: !noWorktreeYet })

  if (noWorktreeYet) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No changes yet. The worktree is created when work on the code starts: in a hub, after
        you approve the plan.
      </p>
    )
  }
  if (diff.isPending) {
    return (
      <div className="grid grid-cols-[15rem_1fr] gap-0" aria-busy="true">
        <div className="flex flex-col gap-2 border-r p-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    )
  }
  if (diff.error !== null) {
    return (
      <div className="p-4">
        <LoadError what="the diff" message={diff.error.message} />
      </div>
    )
  }
  if (diff.data.files.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No changes against the base branch.</p>
    )
  }
  return <DiffView diff={diff.data} />
}
