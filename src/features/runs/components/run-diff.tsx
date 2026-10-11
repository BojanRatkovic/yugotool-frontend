import { useQuery } from '@tanstack/react-query'
import { FileDiff } from 'lucide-react'
import { useMemo } from 'react'

import { LoadError } from '@/components/data-state'
import { Skeleton } from '@/components/ui/skeleton'
import { runQueries } from '@/features/runs/api/run-queries'
import { parsePatch, type DiffFile, type DiffLine } from '@/lib/diff'
import type { Run } from '@/lib/contracts'
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

function fileAnchor(path: string): string {
  return `diff-${path.replaceAll(/[^\w-]/g, '_')}`
}

function Counts({ file }: { file: DiffFile }) {
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-[0.6875rem] tabular-nums">
      <span className="text-status-passed">+{file.additions}</span>
      <span className="text-status-failed">−{file.deletions}</span>
    </span>
  )
}

function FilePatch({ file }: { file: DiffFile }) {
  return (
    <section id={fileAnchor(file.path)} aria-label={file.path} className="scroll-mt-2 border-b">
      <header className="sticky top-0 z-[5] flex h-9 items-center gap-2 border-b bg-card px-3">
        <FileDiff aria-hidden="true" className="size-3.5 text-muted-foreground" />
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
      </header>
      {file.binary ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">Binary file not shown.</p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-max min-w-full border-collapse font-mono text-[0.75rem] leading-5">
            <tbody>
              {file.lines.map((line, index) => (
                <tr key={index} className={ROW[line.kind]}>
                  {line.kind === 'hunk' ? (
                    <td colSpan={4} className="px-3 py-0.5 whitespace-pre">
                      {line.text}
                    </td>
                  ) : (
                    <>
                      <td className="w-10 min-w-10 border-r px-2 text-right align-top text-muted-foreground/70 select-none">
                        {line.oldNumber ?? ''}
                      </td>
                      <td className="w-10 min-w-10 border-r px-2 text-right align-top text-muted-foreground/70 select-none">
                        {line.newNumber ?? ''}
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
                        {line.text === '' ? ' ' : line.text}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** Worktree diff against the base branch: file list + unified patch with line numbers. */
export function RunDiff({ run }: { run: Run }) {
  // A hub run plans in the hub first; its repo's worktree comes after the plan gate (spec 0014).
  const noWorktreeYet =
    run.worktreePath === null &&
    (run.status === 'running' || run.status === 'awaiting_approval')
  const diff = useQuery({ ...runQueries.diff(run.id), enabled: !noWorktreeYet })
  const files = useMemo(
    () => (diff.data === undefined ? [] : parsePatch(diff.data.patch)),
    [diff.data],
  )

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
  if (files.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No changes against the base branch.</p>
    )
  }

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
          data-testid="diff-file-list"
          className="relative min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2"
        >
          <ul className="flex flex-col">
            {files.map((file) => (
              <li key={file.path}>
                <a
                  href={`#${fileAnchor(file.path)}`}
                  className="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-accent"
                  title={file.path}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
                  <Counts file={file} />
                </a>
              </li>
            ))}
          </ul>
          {diff.data.truncated ? (
            <p className="px-2 pt-2 text-xs text-muted-foreground">
              The patch was truncated. Open the worktree in the editor for the full diff.
            </p>
          ) : null}
        </div>
      </nav>
      <div className="relative min-h-0 min-w-0 scrollbar-thin overflow-y-auto">
        {files.map((file) => (
          <FilePatch key={file.path} file={file} />
        ))}
      </div>
    </div>
  )
}
