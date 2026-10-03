import { describe, expect, it } from 'vitest'

import { diffStatBlocks, parseDiffStat, splitPath } from '@/features/runs/utils/diff-stat'

describe('parseDiffStat', () => {
  it('parses a single-file stat (first line already trimmed)', () => {
    const stat = parseDiffStat(
      'packages/time/components/approvals/approval-group-header.tsx | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)',
    )
    expect(stat).toEqual({
      files: [
        {
          path: 'packages/time/components/approvals/approval-group-header.tsx',
          changes: 2,
          addedRatio: 0.5,
          binary: null,
        },
      ],
      filesChanged: 1,
      insertions: 1,
      deletions: 1,
    })
  })

  it('parses insertions-only totals and several files', () => {
    const stat = parseDiffStat(
      'index.html | 1 +\n styles.css | 4 +++-\n 2 files changed, 4 insertions(+)',
    )
    expect(stat?.files.map((file) => [file.path, file.changes, file.addedRatio])).toEqual([
      ['index.html', 1, 1],
      ['styles.css', 4, 0.75],
    ])
    expect(stat?.deletions).toBe(0)
    expect(stat?.insertions).toBe(4)
  })

  it('handles binary files and deletions-only totals', () => {
    const stat = parseDiffStat(
      ' logo.png | Bin 120 -> 340 bytes\n old.ts | 3 ---\n 2 files changed, 3 deletions(-)',
    )
    expect(stat?.files[0]).toMatchObject({
      path: 'logo.png',
      changes: null,
      binary: 'Bin 120 -> 340 bytes',
    })
    expect(stat?.files[1]?.addedRatio).toBe(0)
    expect(stat?.deletions).toBe(3)
  })

  it('rejects text that is not purely a stat', () => {
    expect(parseDiffStat('1 file changed, 1 insertion(+)')).toBeNull()
    expect(parseDiffStat('Changed: a | b\n 1 file changed')).toBeNull()
    expect(
      parseDiffStat('index.html | 1 +\nsomething else\n 1 file changed, 1 insertion(+)'),
    ).toBeNull()
  })
})

describe('diffStatBlocks', () => {
  it('splits five squares by the +/- share', () => {
    const file = { path: 'a', changes: 4, addedRatio: 0.75, binary: null }
    expect(diffStatBlocks(file)).toEqual({ added: 4, deleted: 1 })
    expect(diffStatBlocks({ ...file, addedRatio: null })).toEqual({ added: 0, deleted: 0 })
  })
})

describe('splitPath', () => {
  it('separates directory and basename', () => {
    expect(splitPath('src/a/b.ts')).toEqual(['src/a/', 'b.ts'])
    expect(splitPath('README.md')).toEqual(['', 'README.md'])
  })
})
