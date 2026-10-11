import { describe, expect, it } from 'vitest'

import { diffRows, fileRowAt } from '@/features/runs/components/diff-rows'
import type { DiffFile } from '@/lib/contracts'

const file = (path: string, extra: Partial<DiffFile> = {}): DiffFile => ({
  path,
  oldPath: null,
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  ...extra,
})

const PATCH = `diff --git a/a.ts b/a.ts
index 1..2 100644
--- a/a.ts
+++ b/a.ts
@@ -1 +1 @@
-old
+\tnew line
`

describe('diffRows', () => {
  it('lists every file, with a note for the ones the patch has no lines for', () => {
    const files = [file('a.ts'), file('logo.png', { binary: true }), file('late.ts')]
    const { rows, fileRows, maxChars } = diffRows(files, PATCH, true)
    expect(rows.map((row) => row.kind)).toEqual([
      'file',
      'line',
      'line',
      'line',
      'file',
      'note',
      'file',
      'note',
    ])
    expect(fileRows).toEqual([0, 4, 6])
    expect(rows[7]).toMatchObject({ kind: 'note', text: expect.stringMatching(/size cap/) })
    expect(maxChars).toBe('\tnew line'.length + 7)
  })

  it('says why a complete patch has no lines for a file', () => {
    const { rows } = diffRows([file('empty.txt', { additions: 0, deletions: 0 })], '', false)
    expect(rows[1]).toMatchObject({
      kind: 'note',
      text: expect.stringMatching(/No line changes/),
    })
  })
})

describe('fileRowAt', () => {
  it('finds the header of the file a row belongs to', () => {
    expect(fileRowAt([0, 4, 6], 0)).toBe(0)
    expect(fileRowAt([0, 4, 6], 3)).toBe(0)
    expect(fileRowAt([0, 4, 6], 4)).toBe(4)
    expect(fileRowAt([0, 4, 6], 99)).toBe(6)
  })
})
