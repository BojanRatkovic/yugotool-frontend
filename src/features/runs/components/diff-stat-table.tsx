import { useState } from 'react'

import { diffStatBlocks, splitPath, type DiffStat } from '@/features/runs/utils/diff-stat'
import { cn } from '@/lib/utils'

/** Files shown before "Show all N files". */
const COLLAPSED_FILES = 12

function Blocks({ added, deleted }: { added: number; deleted: number }) {
  return (
    <span aria-hidden="true" className="flex gap-px">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'size-[7px] rounded-[1.5px]',
            index < added
              ? 'bg-status-passed'
              : index < added + deleted
                ? 'bg-status-failed'
                : 'bg-muted-foreground/25',
          )}
        />
      ))}
    </span>
  )
}

/**
 * `git diff --stat` as GitHub shows it: path (directory dimmed, truncated
 * from the left), lines changed, five +/- squares, then the totals.
 */
export function DiffStatTable({ stat }: { stat: DiffStat }) {
  const [showAll, setShowAll] = useState(false)
  const hidden = stat.files.length - COLLAPSED_FILES
  const files = showAll || hidden <= 0 ? stat.files : stat.files.slice(0, COLLAPSED_FILES)
  return (
    <div className="flex w-fit max-w-full flex-col overflow-hidden rounded-md border bg-muted/40 font-mono text-[0.75rem] leading-5">
      <ul className="grid max-h-80 scrollbar-thin grid-cols-[minmax(0,max-content)_auto_auto] gap-x-3 overflow-y-auto py-1">
        {files.map((file, index) => {
          const [dir, base] = splitPath(file.path)
          const blocks = diffStatBlocks(file)
          return (
            <li
              key={`${file.path}-${index}`}
              className="col-span-3 grid grid-cols-subgrid items-center px-2.5"
            >
              {/* rtl + bdi: an overlong path loses its start, not the file name. */}
              <span dir="rtl" className="truncate text-left" title={file.path}>
                <bdi>
                  <span className="text-muted-foreground">{dir}</span>
                  <span className="text-foreground">{base}</span>
                </bdi>
              </span>
              <span className="text-right text-muted-foreground tabular-nums">
                {file.binary ?? file.changes}
              </span>
              <Blocks {...blocks} />
            </li>
          )
        })}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="border-t px-2.5 py-1 text-left font-sans text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          {showAll ? 'Show fewer files' : `Show all ${stat.files.length} files`}
        </button>
      ) : null}
      <p className="flex flex-wrap gap-x-2 border-t px-2.5 py-1 text-muted-foreground tabular-nums">
        <span>
          {stat.filesChanged} {stat.filesChanged === 1 ? 'file' : 'files'} changed
        </span>
        {stat.insertions > 0 ? (
          <span className="text-status-passed">+{stat.insertions}</span>
        ) : null}
        {stat.deletions > 0 ? (
          <span className="text-status-failed">−{stat.deletions}</span>
        ) : null}
      </p>
    </div>
  )
}
