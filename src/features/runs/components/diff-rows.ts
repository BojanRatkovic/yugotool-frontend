import { parsePatch, type DiffLine } from '@/lib/diff'
import type { DiffFile } from '@/lib/contracts'

/** One fixed-height row of the virtualized patch. */
export type DiffRow =
  | { kind: 'file'; file: DiffFile }
  | { kind: 'line'; line: DiffLine }
  | { kind: 'note'; text: string }

export const ROW_HEIGHT: Record<DiffRow['kind'], number> = { file: 36, line: 20, note: 32 }

export interface DiffRows {
  rows: DiffRow[]
  /** Row index of each file's header, in `files` order. */
  fileRows: number[]
  /** Longest line in characters (tabs as 8), for the horizontal scroll width. */
  maxChars: number
}

/**
 * The complete file list (from `--numstat`) interleaved with the patch's lines.
 * A file with no hunks in the patch gets a note instead, so nothing listed is
 * silently missing.
 */
export function diffRows(files: DiffFile[], patch: string, truncated: boolean): DiffRows {
  const patched = new Map(parsePatch(patch).map((file) => [file.path, file.lines]))
  const rows: DiffRow[] = []
  const fileRows: number[] = []
  let maxChars = 0
  for (const file of files) {
    fileRows.push(rows.length)
    rows.push({ kind: 'file', file })
    const lines = patched.get(file.path) ?? []
    if (file.binary) rows.push({ kind: 'note', text: 'Binary file not shown.' })
    else if (lines.length > 0) {
      for (const line of lines) {
        rows.push({ kind: 'line', line })
        maxChars = Math.max(maxChars, line.text.length + countTabs(line.text) * 7)
      }
    } else if (truncated) {
      rows.push({
        kind: 'note',
        text: 'Past the size cap of the patch. Open the worktree in the editor to see it.',
      })
    } else rows.push({ kind: 'note', text: 'No line changes (empty file or mode change).' })
  }
  return { rows, fileRows, maxChars }
}

function countTabs(text: string): number {
  let tabs = 0
  for (const char of text) if (char === '\t') tabs += 1
  return tabs
}

/** The header of the file the scroll position is in: the last header at or before `index`. */
export function fileRowAt(fileRows: number[], index: number): number {
  let low = 0
  let high = fileRows.length - 1
  let found = fileRows[0] ?? 0
  while (low <= high) {
    const mid = (low + high) >> 1
    const row = fileRows[mid] ?? 0
    if (row <= index) {
      found = row
      low = mid + 1
    } else high = mid - 1
  }
  return found
}
