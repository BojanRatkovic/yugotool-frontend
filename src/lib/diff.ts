export type DiffLineKind = 'context' | 'add' | 'del' | 'hunk' | 'meta'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  oldNumber: number | null
  newNumber: number | null
}

export interface DiffFile {
  path: string
  /** Set when the file was renamed. */
  oldPath: string | null
  additions: number
  deletions: number
  status: 'added' | 'deleted' | 'modified' | 'renamed'
  binary: boolean
  lines: DiffLine[]
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/

function newFile(oldPath: string, path: string): DiffFile {
  const renamed = oldPath !== path
  return {
    path,
    oldPath: renamed ? oldPath : null,
    additions: 0,
    deletions: 0,
    status: renamed ? 'renamed' : 'modified',
    binary: false,
    lines: [],
  }
}

/** Extended header lines between `diff --git` and the first hunk. */
function readFileHeader(file: DiffFile, line: string): void {
  if (line.startsWith('new file')) file.status = 'added'
  else if (line.startsWith('deleted file')) file.status = 'deleted'
  else if (line.startsWith('Binary files')) file.binary = true
}

/** Line numbers of the next old/new line inside the current hunk. */
interface Cursor {
  old: number
  new: number
}

function readHunkLine(file: DiffFile, line: string, at: Cursor): void {
  const lead = line[0]
  if (lead === '+') {
    file.additions += 1
    file.lines.push({ kind: 'add', text: line.slice(1), oldNumber: null, newNumber: at.new++ })
  } else if (lead === '-') {
    file.deletions += 1
    file.lines.push({ kind: 'del', text: line.slice(1), oldNumber: at.old++, newNumber: null })
  } else if (lead === '\\') {
    file.lines.push({ kind: 'meta', text: line, oldNumber: null, newNumber: null })
  } else if (line !== '' || file.lines.length > 0) {
    const text = line.slice(1)
    file.lines.push({ kind: 'context', text, oldNumber: at.old++, newNumber: at.new++ })
  }
}

/** Unified `git diff` output → files with numbered lines. */
export function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = []
  let file: DiffFile | undefined
  let at: Cursor | null = null

  for (const line of patch.split('\n')) {
    const header = FILE_HEADER.exec(line)
    if (header !== null) {
      file = newFile(header[1] ?? '', header[2] ?? '')
      files.push(file)
      at = null
      continue
    }
    if (file === undefined) continue
    const hunk = HUNK.exec(line)
    if (hunk !== null) {
      at = { old: Number(hunk[1]), new: Number(hunk[2]) }
      file.lines.push({ kind: 'hunk', text: line, oldNumber: null, newNumber: null })
    } else if (at === null) readFileHeader(file, line)
    else readHunkLine(file, line, at)
  }
  // A trailing empty line from split() is not context.
  for (const each of files) {
    const last = each.lines.at(-1)
    if (last?.kind === 'context' && last.text === '') each.lines.pop()
  }
  return files
}
