import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { LoadError } from '@/components/data-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { prQueries } from '@/features/pull-requests/api/pr-queries'
import { useSetFileViewed } from '@/features/pull-requests/api/pr-mutations'
import {
  lineAnchor,
  PrFileDiff,
  type CommentTarget,
} from '@/features/pull-requests/components/pr-file-diff'
import { PrFileTree } from '@/features/pull-requests/components/pr-file-tree'
import type { PrPanelState } from '@/features/pull-requests/components/pr-panel'
import { placePr } from '@/features/pull-requests/utils/columns'
import {
  cycleThread,
  nextUnviewed,
  parseLineKey,
  stepFile,
} from '@/features/pull-requests/utils/file-nav'
import { visibleFiles, type FileTreeNode } from '@/features/pull-requests/utils/file-tree'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { PrDiff, PullRequestDetail } from '@/lib/contracts'
import { parsePatch } from '@/lib/diff'
import { isPanelTypingTarget } from '@/features/pull-requests/utils/keys'
import { ghostFindings } from '@/features/pull-requests/utils/yugotool'

/** Whether "Since your last review" applies, and whether it's on by default (Re-review). */
function sinceReview(pr: PullRequestDetail, viewer: string) {
  const last = pr.myLastReview
  const available = pr.author.login !== viewer && last !== null && last.commitOid !== pr.headOid
  return {
    available,
    byDefault: available && placePr(pr, 'assigned').column === 're_review',
    commitOid: available ? (last?.commitOid ?? null) : null,
  }
}

/**
 * The review surface: a file tree with viewed state on the left, one file at
 * a time on the right with its threads, line comments into the pending
 * review, and the "since your last review" view. Keys: j/k files, v viewed
 * (then the next unviewed), n/p threads, c comment on the focused line.
 */
export function PrFilesTab({
  projectId,
  pr,
  viewer,
  state,
  onChange,
}: {
  projectId: string
  pr: PullRequestDetail
  viewer: string
  state: PrPanelState
  onChange: (next: Partial<PrPanelState>) => void
}) {
  const since = sinceReview(pr, viewer)
  const sinceOn =
    since.available &&
    (state.since === 'review' || (state.since === undefined && since.byDefault))
  const sinceDiff = useQuery({
    ...prQueries.diff(projectId, pr.number, since.commitOid ?? '', pr.headOid),
    enabled: sinceOn && since.commitOid !== null,
  })
  // GitHub no longer knows the commit (force push): fall back to the whole PR.
  const sinceGone =
    sinceDiff.error instanceof ApiError && sinceDiff.error.code === 'since_unknown'
  const useSince = sinceOn && !sinceGone
  const fullDiff = useQuery({
    ...prQueries.diff(projectId, pr.number, null, pr.headOid),
    enabled: !useSince,
  })
  const diff = useSince ? sinceDiff : fullDiff
  const parsed = useMemo(
    () => (diff.data === undefined ? [] : parsePatch(diff.data.patch)),
    [diff.data],
  )
  const parsedByPath = useMemo(() => new Map(parsed.map((f) => [f.path, f])), [parsed])

  const files = useMemo(
    () =>
      useSince && diff.data !== undefined
        ? pr.files.filter((f) => parsedByPath.has(f.path))
        : pr.files,
    [useSince, diff.data, pr.files, parsedByPath],
  )
  const openThreads = useMemo(
    () => pr.reviewThreads.filter((t) => !t.isOutdated),
    [pr.reviewThreads],
  )
  const threadsByPath = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of openThreads) if (!t.isResolved) map.set(t.path, (map.get(t.path) ?? 0) + 1)
    return map
  }, [openThreads])

  const [order, setOrder] = useState<string[]>([])
  const onVisibleChange = useCallback(
    (tree: FileTreeNode[], collapsed: ReadonlySet<string>) =>
      setOrder(visibleFiles(tree, collapsed)),
    [],
  )
  const selectedPath =
    state.file !== undefined && files.some((f) => f.path === state.file) ? state.file : order[0]
  const selected = files.find((f) => f.path === selectedPath)
  const fileThreads = openThreads.filter((t) => t.path === selectedPath)
  // YugoTool findings not posted yet, on this file's lines; only for the head they were made on.
  const yugotool = useQuery(prQueries.yugotoolReview(projectId, pr.number, pr.headOid))
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const ghosts = ghostFindings(yugotool.data?.review ?? null, selectedPath, dismissed)

  const [focusedLine, setFocusedLine] = useState<string | null>(null)
  const [commentTarget, setCommentTarget] = useState<CommentTarget | null>(null)
  const diffRef = useRef<HTMLDivElement>(null)
  const viewed = useSetFileViewed(projectId, pr.number)

  const selectFile = (path: string | undefined) => {
    setCommentTarget(null)
    setFocusedLine(null)
    onChange({ file: path, thread: undefined })
    diffRef.current?.scrollTo({ top: 0 })
  }
  const setViewed = (path: string, value: boolean) =>
    viewed.mutate(
      { path, viewed: value },
      { onError: (error) => toast.error(`Couldn't mark as viewed: ${errorMessage(error)}`) },
    )

  // A thread in the URL (from Threads or a review card) opens its file and scrolls to it.
  useEffect(() => {
    // Threads render with the diff: wait until it's parsed.
    if (state.thread === undefined || parsed.length === 0) return
    const thread = pr.reviewThreads.find((t) => t.id === state.thread)
    if (
      thread !== undefined &&
      thread.path !== state.file &&
      files.some((f) => f.path === thread.path)
    ) {
      onChange({ file: thread.path })
    }
    // Scroll the diff pane only: scrollIntoView would also move the page under the panel.
    requestAnimationFrame(() => {
      const pane = diffRef.current
      const el = pane?.querySelector(`[data-pr-thread="${CSS.escape(state.thread ?? '')}"]`)
      if (pane == null || !(el instanceof HTMLElement)) return
      const top =
        el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
      pane.scrollTo({ top: Math.max(0, top - pane.clientHeight / 3) })
    })
  }, [state.thread, state.file, pr.reviewThreads, files, onChange, parsed])

  /** The first added or removed line of the open file, as a focused-line key. */
  const firstChangedLine = () => {
    const first = parsedByPath
      .get(selectedPath ?? '')
      ?.lines.find((l) => l.kind === 'add' || l.kind === 'del')
    const anchor = first === undefined ? null : lineAnchor(first)
    return anchor === null ? null : `${anchor.side}${anchor.line}`
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isPanelTypingTarget(event.target))
        return
      switch (event.key) {
        case 'j':
        case 'k': {
          const next = stepFile(order, selectedPath, event.key === 'j' ? 1 : -1)
          if (next !== undefined) selectFile(next)
          break
        }
        case 'v': {
          if (selected === undefined) return
          setViewed(selected.path, !selected.viewed)
          if (!selected.viewed) {
            const next = nextUnviewed(order, selectedPath, files)
            if (next !== undefined) selectFile(next)
          }
          break
        }
        case 'n':
        case 'p': {
          const next = cycleThread(fileThreads, state.thread, event.key === 'n' ? 1 : -1)
          if (next === undefined) return
          onChange({ thread: next })
          break
        }
        case 'c': {
          const target = parseLineKey(focusedLine ?? firstChangedLine() ?? '')
          if (target === null) return
          setCommentTarget(target)
          break
        }
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="grid h-full min-h-0 grid-cols-[16.25rem_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col">
        {since.available ? (
          <div className="flex items-center gap-2 border-r border-b px-3 py-2 text-xs">
            <Switch
              id={`since-${pr.number}`}
              size="sm"
              checked={sinceOn}
              onCheckedChange={(on) =>
                onChange({ since: on ? 'review' : 'all', file: undefined })
              }
            />
            <label htmlFor={`since-${pr.number}`}>Since your last review</label>
          </div>
        ) : null}
        <PrFileTree
          files={files}
          selected={selectedPath}
          threadsByPath={threadsByPath}
          onSelect={selectFile}
          onViewed={(file, value) => setViewed(file.path, value)}
          onVisibleChange={onVisibleChange}
        />
      </div>
      <div ref={diffRef} className="min-h-0 overflow-y-auto">
        {sinceOn && sinceGone ? (
          <p className="border-b bg-status-waiting-soft px-4 py-2 text-xs text-status-waiting">
            Your last reviewed commit is gone from GitHub (force push), so this is the whole PR.
          </p>
        ) : null}
        {pr.truncated.files ? (
          <p className="border-b px-4 py-2 text-xs text-muted-foreground">
            Showing the first {pr.files.length} files.{' '}
            <a
              href={`${pr.url}/files`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              All files on GitHub
            </a>
          </p>
        ) : null}
        <DiffPaneBody
          diff={diff}
          emptyNote={
            selected === undefined
              ? useSince
                ? 'Nothing changed in the PR’s files since your last review.'
                : 'No files.'
              : null
          }
        >
          {(data) =>
            selected === undefined ? null : (
              <PrFileDiff
                key={selected.path}
                projectId={projectId}
                pr={pr}
                file={selected}
                diff={
                  data.truncated && !parsedByPath.has(selected.path)
                    ? null
                    : (parsedByPath.get(selected.path) ?? null)
                }
                threads={fileThreads}
                ghosts={ghosts}
                onDismissGhost={(id) => setDismissed(new Set([...dismissed, id]))}
                focusedThread={state.thread}
                focusedLine={focusedLine}
                commentTarget={commentTarget}
                onFocusLine={setFocusedLine}
                onComment={setCommentTarget}
                onViewed={(value) => setViewed(selected.path, value)}
              />
            )
          }
        </DiffPaneBody>
      </div>
    </div>
  )
}

/** The diff pane under its notices: load error, skeleton, an empty note, or the file. */
function DiffPaneBody({
  diff,
  emptyNote,
  children,
}: {
  diff: { data: PrDiff | undefined; error: Error | null }
  emptyNote: string | null
  children: (data: PrDiff) => React.ReactNode
}) {
  if (diff.data === undefined && diff.error !== null) {
    return (
      <div className="p-4">
        <LoadError what="the diff" message={diff.error.message} />
      </div>
    )
  }
  if (diff.data === undefined) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    )
  }
  if (emptyNote !== null)
    return <p className="p-4 text-sm text-muted-foreground">{emptyNote}</p>
  return children(diff.data)
}
