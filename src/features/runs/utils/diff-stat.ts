export interface DiffStatFile {
  path: string
  /** Lines changed (git's count); null for binary files. */
  changes: number | null
  /** Share of `+` in git's bar (0–1); null when there's no bar. */
  addedRatio: number | null
  /** `Bin 120 -> 340 bytes` for binary files. */
  binary: string | null
}

export interface DiffStat {
  files: DiffStatFile[]
  filesChanged: number
  insertions: number
  deletions: number
}

const FILE_LINE = /^\s*(.+?)\s+\|\s+(?:(\d+)(?:\s+([+-]+))?|(Bin(?: \d+ -> \d+ bytes)?))\s*$/
const SUMMARY_LINE =
  /^\s*(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?\s*$/

/**
 * `git diff --stat` output → files + totals. Null unless the whole text is a
 * stat (file lines, then the summary line), so prose never matches.
 */
export function parseDiffStat(text: string): DiffStat | null {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const summary = SUMMARY_LINE.exec(lines.at(-1) ?? '')
  if (summary === null || lines.length < 2) return null
  const files: DiffStatFile[] = []
  for (const line of lines.slice(0, -1)) {
    const match = FILE_LINE.exec(line)
    if (match === null) return null
    const [, path = '', count, bar, binary] = match
    const plus = bar?.split('+').length ?? 1
    const ratio = bar === undefined || bar === '' ? null : (plus - 1) / bar.length
    files.push({
      path,
      changes: count === undefined ? null : Number(count),
      addedRatio: ratio,
      binary: binary ?? null,
    })
  }
  return {
    files,
    filesChanged: Number(summary[1]),
    insertions: Number(summary[2] ?? 0),
    deletions: Number(summary[3] ?? 0),
  }
}

/** GitHub's five squares: how many are green, red, neutral. */
export function diffStatBlocks(
  file: DiffStatFile,
  blocks = 5,
): { added: number; deleted: number } {
  if (file.addedRatio === null || file.changes === null || file.changes === 0) {
    return { added: 0, deleted: 0 }
  }
  const added = Math.round(file.addedRatio * blocks)
  return { added, deleted: blocks - added }
}

/** `src/a/b.ts` → `['src/a/', 'b.ts']`; renames (`{x => y}`) keep their braces in the dir part. */
export function splitPath(path: string): [dir: string, base: string] {
  const at = path.lastIndexOf('/')
  return at < 0 ? ['', path] : [path.slice(0, at + 1), path.slice(at + 1)]
}
