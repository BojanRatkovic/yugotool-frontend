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

/** Unified `git diff` output → files with numbered lines. */
export function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = []
  let file: DiffFile | undefined
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (const line of patch.split('\n')) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
    if (header !== null) {
      file = {
        path: header[2] ?? '',
        oldPath: header[1] === header[2] ? null : (header[1] ?? null),
        additions: 0,
        deletions: 0,
        status: header[1] === header[2] ? 'modified' : 'renamed',
        binary: false,
        lines: [],
      }
      files.push(file)
      inHunk = false
      continue
    }
    if (file === undefined) continue
    const hunk = HUNK.exec(line)
    if (hunk !== null) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      inHunk = true
      file.lines.push({ kind: 'hunk', text: line, oldNumber: null, newNumber: null })
      continue
    }
    if (!inHunk) {
      if (line.startsWith('new file')) file.status = 'added'
      else if (line.startsWith('deleted file')) file.status = 'deleted'
      else if (line.startsWith('Binary files')) file.binary = true
      continue
    }
    if (line.startsWith('+')) {
      file.additions += 1
      file.lines.push({ kind: 'add', text: line.slice(1), oldNumber: null, newNumber: newLine })
      newLine += 1
    } else if (line.startsWith('-')) {
      file.deletions += 1
      file.lines.push({ kind: 'del', text: line.slice(1), oldNumber: oldLine, newNumber: null })
      oldLine += 1
    } else if (line.startsWith('\\')) {
      file.lines.push({ kind: 'meta', text: line, oldNumber: null, newNumber: null })
    } else if (line !== '' || file.lines.length > 0) {
      file.lines.push({
        kind: 'context',
        text: line.slice(1),
        oldNumber: oldLine,
        newNumber: newLine,
      })
      oldLine += 1
      newLine += 1
    }
  }
  // A trailing empty line from split() is not context.
  for (const each of files) {
    const last = each.lines.at(-1)
    if (last?.kind === 'context' && last.text === '') each.lines.pop()
  }
  return files
}
