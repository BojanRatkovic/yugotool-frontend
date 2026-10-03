import type { PrFile } from '@/lib/contracts'

export type FileTreeNode =
  | { kind: 'dir'; name: string; path: string; children: FileTreeNode[] }
  | { kind: 'file'; name: string; path: string; file: PrFile }

interface MutableDir {
  dirs: Map<string, MutableDir>
  files: PrFile[]
}

/**
 * The PR's files as a tree: directories first, then files, both by name, and
 * single-child directory chains compacted into one row (`src/app/routes`). Pure.
 */
export function buildFileTree(files: PrFile[]): FileTreeNode[] {
  const root: MutableDir = { dirs: new Map(), files: [] }
  for (const file of files) {
    const parts = file.path.split('/')
    let dir = root
    for (const part of parts.slice(0, -1)) {
      let next = dir.dirs.get(part)
      if (next === undefined) {
        next = { dirs: new Map(), files: [] }
        dir.dirs.set(part, next)
      }
      dir = next
    }
    dir.files.push(file)
  }
  return toNodes(root, '')
}

function toNodes(dir: MutableDir, prefix: string): FileTreeNode[] {
  const dirs = [...dir.dirs.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([name, child]) => compact(name, child, prefix))
  const files = dir.files
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .map((file): FileTreeNode => ({
      kind: 'file',
      name: file.path.slice(file.path.lastIndexOf('/') + 1),
      path: file.path,
      file,
    }))
  return [...dirs, ...files]
}

function compact(name: string, dir: MutableDir, prefix: string): FileTreeNode {
  let label = name
  let current = dir
  // Fold a directory that holds exactly one directory and no files into its child.
  while (current.files.length === 0 && current.dirs.size === 1) {
    const [childName, child] = [...current.dirs.entries()][0] ?? []
    if (childName === undefined || child === undefined) break
    label = `${label}/${childName}`
    current = child
  }
  const path = `${prefix}${label}`
  return { kind: 'dir', name: label, path, children: toNodes(current, `${path}/`) }
}

/** File paths in display order (what `j`/`k` walk), skipping collapsed directories. */
export function visibleFiles(
  nodes: FileTreeNode[],
  collapsed: ReadonlySet<string> = new Set(),
): string[] {
  return nodes.flatMap((node) =>
    node.kind === 'file'
      ? [node.path]
      : collapsed.has(node.path)
        ? []
        : visibleFiles(node.children, collapsed),
  )
}
