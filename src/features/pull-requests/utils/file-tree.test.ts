import { describe, expect, it } from 'vitest'

import {
  buildFileTree,
  visibleFiles,
  type FileTreeNode,
} from '@/features/pull-requests/utils/file-tree'
import type { PrFile } from '@/lib/contracts'

const file = (path: string): PrFile => ({
  path,
  additions: 1,
  deletions: 0,
  changeType: 'MODIFIED',
  viewed: false,
})

/** "dir/" and "file" names, indented, for readable expectations. */
function outline(nodes: FileTreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) => [
    `${'  '.repeat(depth)}${node.name}${node.kind === 'dir' ? '/' : ''}`,
    ...(node.kind === 'dir' ? outline(node.children, depth + 1) : []),
  ])
}

describe('buildFileTree', () => {
  it('compacts single-child directory chains and sorts dirs before files', () => {
    const tree = buildFileTree([
      file('src/app/routes/index.tsx'),
      file('src/app/routes/settings.tsx'),
      file('README.md'),
      file('src/lib/a.ts'),
      file('src/lib/deep/only/b.ts'),
    ])
    expect(outline(tree)).toEqual([
      'src/',
      '  app/routes/',
      '    index.tsx',
      '    settings.tsx',
      '  lib/',
      '    deep/only/',
      '      b.ts',
      '    a.ts',
      'README.md',
    ])
    expect(tree[0]?.kind === 'dir' && tree[0].children[0]?.path).toBe('src/app/routes')
  })

  it('keeps root files flat', () => {
    expect(outline(buildFileTree([file('b.ts'), file('a.ts')]))).toEqual(['a.ts', 'b.ts'])
  })
})

describe('visibleFiles', () => {
  it('walks files in display order and skips collapsed directories', () => {
    const tree = buildFileTree([file('src/a.ts'), file('src/x/b.ts'), file('c.ts')])
    expect(visibleFiles(tree)).toEqual(['src/x/b.ts', 'src/a.ts', 'c.ts'])
    expect(visibleFiles(tree, new Set(['src/x']))).toEqual(['src/a.ts', 'c.ts'])
  })
})
