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
import { visibleFiles, type FileTreeNode } from '@/features/pull-requests/utils/file-tree'
import { ApiError, errorMessage } from '@/lib/api-client'
import type { PullRequestDetail } from '@/lib/contracts'
import { parsePatch } from '@/lib/diff'
import { isPanelTypingTarget } from '@/features/pull-requests/utils/keys'

/** Whether "Since your last review" applies, and whether it's on by default (Re-review). */
export function sinceReview(pr: PullRequestDetail, viewer: string) {
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
  const review = yugotool.data?.review ?? null
  const verdict = review !== null && !review.stale ? review.verdict : null
  const ghosts = (verdict?.findings ?? []).filter(
    (f) =>
      f.file === selectedPath &&
      f.line !== null &&
      review?.pullRequest.posted.includes(f.id) !== true &&
      !dismissed.has(f.id),
  )

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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isPanelTypingTarget(event.target))
        return
      const index = selectedPath === undefined ? -1 : order.indexOf(selectedPath)
      switch (event.key) {
        case 'j':
        case 'k': {
          const next =
            order[Math.max(0, Math.min(order.length - 1, index + (event.key === 'j' ? 1 : -1)))]
          if (next !== undefined) selectFile(next)
          break
        }
        case 'v': {
          if (selected === undefined) return
          setViewed(selected.path, !selected.viewed)
          if (!selected.viewed) {
            const rest = [...order.slice(index + 1), ...order.slice(0, index)]
            const nextUnviewed = rest.find(
              (p) => files.find((f) => f.path === p)?.viewed === false,
            )
            if (nextUnviewed !== undefined) selectFile(nextUnviewed)
          }
          break
        }
        case 'n':
        case 'p': {
          const ids = fileThreads
            .filter((t) => t.line !== null)
            .toSorted((a, b) => (a.line ?? 0) - (b.line ?? 0))
            .map((t) => t.id)
          if (ids.length === 0) return
          const at = state.thread === undefined ? -1 : ids.indexOf(state.thread)
          const next =
            event.key === 'n'
              ? ids[(at + 1) % ids.length]
              : ids[(at - 1 + ids.length) % ids.length]
          onChange({ thread: next })
          break
        }
        case 'c': {
          const line =
            focusedLine ??
            (() => {
              const first = parsedByPath
                .get(selectedPath ?? '')
                ?.lines.find((l) => l.kind === 'add' || l.kind === 'del')
              const anchor = first === undefined ? null : lineAnchor(first)
              return anchor === null ? null : `${anchor.side}${anchor.line}`
            })()
          const match = line === null ? null : /^(LEFT|RIGHT)(\d+)$/.exec(line)
          if (match === null) return
          setCommentTarget({
            side: match[1] === 'LEFT' ? 'LEFT' : 'RIGHT',
            line: Number(match[2]),
          })
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
        {diff.data === undefined && diff.error !== null ? (
          <div className="p-4">
            <LoadError what="the diff" message={diff.error.message} />
          </div>
        ) : diff.data === undefined ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : selected === undefined ? (
          <p className="p-4 text-sm text-muted-foreground">
            {useSince
              ? 'Nothing changed in the PR’s files since your last review.'
              : 'No files.'}
          </p>
        ) : (
          <PrFileDiff
            key={selected.path}
            projectId={projectId}
            pr={pr}
            file={selected}
            diff={
              diff.data.truncated && !parsedByPath.has(selected.path)
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
        )}
      </div>
    </div>
  )
}
