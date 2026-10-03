import {
  ChevronRight,
  FileMinus,
  FilePen,
  FilePlus,
  FileSymlink,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { buildFileTree, type FileTreeNode } from '@/features/pull-requests/utils/file-tree'
import type { PrFile } from '@/lib/contracts'
import { isPanelTypingTarget } from '@/features/pull-requests/utils/keys'
import { cn } from '@/lib/utils'

const CHANGE_ICON: Record<
  PrFile['changeType'],
  { Icon: LucideIcon; className: string; label: string }
> = {
  ADDED: { Icon: FilePlus, className: 'text-status-passed', label: 'added' },
  DELETED: { Icon: FileMinus, className: 'text-status-failed', label: 'deleted' },
  MODIFIED: { Icon: FilePen, className: 'text-status-running', label: 'modified' },
  RENAMED: { Icon: FileSymlink, className: 'text-status-waiting', label: 'renamed' },
  COPIED: { Icon: FileSymlink, className: 'text-status-waiting', label: 'copied' },
  CHANGED: { Icon: FilePen, className: 'text-status-running', label: 'changed' },
}

function TreeRows({
  nodes,
  depth,
  selected,
  collapsed,
  threadsByPath,
  onToggleDir,
  onSelect,
  onViewed,
}: {
  nodes: FileTreeNode[]
  depth: number
  selected: string | undefined
  collapsed: ReadonlySet<string>
  threadsByPath: ReadonlyMap<string, number>
  onToggleDir: (path: string) => void
  onSelect: (path: string) => void
  onViewed: (file: PrFile, viewed: boolean) => void
}) {
  return nodes.map((node) => {
    const indent = { paddingLeft: `${0.5 + depth * 0.75}rem` }
    if (node.kind === 'dir') {
      const open = !collapsed.has(node.path)
      return (
        <li key={node.path}>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => onToggleDir(node.path)}
            style={indent}
            className="flex h-7 w-full min-w-0 items-center gap-1 pr-2 text-left text-xs text-muted-foreground hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')}
            />
            <span className="truncate font-mono">{node.name}</span>
          </button>
          {open ? (
            <ul>
              <TreeRows
                nodes={node.children}
                depth={depth + 1}
                selected={selected}
                collapsed={collapsed}
                threadsByPath={threadsByPath}
                onToggleDir={onToggleDir}
                onSelect={onSelect}
                onViewed={onViewed}
              />
            </ul>
          ) : null}
        </li>
      )
    }
    const change = CHANGE_ICON[node.file.changeType]
    const threads = threadsByPath.get(node.path) ?? 0
    const isSelected = node.path === selected
    return (
      <li
        key={node.path}
        className={cn(
          'group flex h-7 items-center gap-1.5 pr-2 hover:bg-accent/60',
          isSelected && 'bg-accent',
        )}
        style={indent}
      >
        <input
          type="checkbox"
          checked={node.file.viewed}
          onChange={(event) => onViewed(node.file, event.target.checked)}
          aria-label={`Viewed ${node.path}`}
          className="size-3.5 shrink-0 accent-[var(--status-passed)]"
        />
        <button
          type="button"
          data-pr-file={node.path}
          aria-current={isSelected ? 'true' : undefined}
          onClick={() => onSelect(node.path)}
          title={node.path}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs focus-visible:underline focus-visible:outline-none',
            node.file.viewed && 'text-muted-foreground',
          )}
        >
          <change.Icon
            aria-hidden="true"
            className={cn('size-3.5 shrink-0', change.className)}
          />
          <span className="sr-only">{change.label}: </span>
          <span className="truncate font-mono">{node.name}</span>
        </button>
        {threads === 0 ? null : (
          <span
            className="flex shrink-0 items-center gap-0.5 font-mono text-[0.625rem] text-status-waiting"
            title={`${threads} open thread${threads === 1 ? '' : 's'}`}
          >
            <MessageSquare aria-hidden="true" className="size-3" />
            {threads}
          </span>
        )}
        <span className="flex shrink-0 gap-1 font-mono text-[0.625rem] tabular-nums">
          <span className="text-status-passed">+{node.file.additions}</span>
          <span className="text-status-failed">−{node.file.deletions}</span>
        </span>
      </li>
    )
  })
}

/**
 * The PR's files as a compacted tree with viewed checkboxes (synced with
 * GitHub), a viewed progress bar and a filter (`/` focuses it).
 */
export function PrFileTree({
  files,
  selected,
  threadsByPath,
  onSelect,
  onViewed,
  onVisibleChange,
}: {
  files: PrFile[]
  selected: string | undefined
  /** Open (unresolved) threads per path. */
  threadsByPath: ReadonlyMap<string, number>
  onSelect: (path: string) => void
  onViewed: (file: PrFile, viewed: boolean) => void
  /** The visible files in display order (j/k walk them). */
  onVisibleChange: (tree: FileTreeNode[], collapsed: ReadonlySet<string>) => void
}) {
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const filterRef = useRef<HTMLInputElement>(null)
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle === '' ? files : files.filter((f) => f.path.toLowerCase().includes(needle))
  }, [files, filter])
  const tree = useMemo(() => buildFileTree(shown), [shown])
  const viewed = files.filter((f) => f.viewed).length

  useEffect(() => onVisibleChange(tree, collapsed), [tree, collapsed, onVisibleChange])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key !== '/' ||
        event.metaKey ||
        event.ctrlKey ||
        isPanelTypingTarget(event.target)
      )
        return
      event.preventDefault()
      filterRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <aside aria-label="Changed files" className="flex min-h-0 flex-col border-r">
      <div className="flex flex-col gap-2 border-b p-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-mono text-foreground tabular-nums">{viewed}</span> /{' '}
            {files.length} viewed
          </span>
        </div>
        {/* The count above says it in words; the bar is decoration. */}
        <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-status-passed transition-[width]"
            style={{ width: `${files.length === 0 ? 0 : (viewed / files.length) * 100}%` }}
          />
        </div>
        <Input
          ref={filterRef}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setFilter('')
              event.currentTarget.blur()
            }
          }}
          placeholder="Filter files  /"
          aria-label="Filter files"
          className="h-7 text-xs"
        />
      </div>
      <ul aria-label="Files" className="min-h-0 flex-1 overflow-y-auto py-1">
        <TreeRows
          nodes={tree}
          depth={0}
          selected={selected}
          collapsed={collapsed}
          threadsByPath={threadsByPath}
          onToggleDir={(path) => {
            const next = new Set(collapsed)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            setCollapsed(next)
          }}
          onSelect={onSelect}
          onViewed={onViewed}
        />
        {shown.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">No files match.</li>
        ) : null}
      </ul>
    </aside>
  )
}
