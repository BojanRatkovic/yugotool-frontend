import { describe, expect, it } from 'vitest'

import { parsePatch } from '@/lib/diff'

const PATCH = `diff --git a/math.js b/math.js
index 1..2 100644
--- a/math.js
+++ b/math.js
@@ -1,3 +1,7 @@
 export function add(a, b) {
   return a + b;
 }
+
+export function multiply(a, b) {
+  return a * b;
+}
diff --git a/new.txt b/new.txt
new file mode 100644
--- /dev/null
+++ b/new.txt
@@ -0,0 +1 @@
+hello
`

describe('parsePatch', () => {
  it('splits files and counts changes', () => {
    const files = parsePatch(PATCH)
    expect(files.map((f) => [f.path, f.additions, f.deletions, f.status])).toEqual([
      ['math.js', 4, 0, 'modified'],
      ['new.txt', 1, 0, 'added'],
    ])
  })

  it('numbers lines on both sides', () => {
    const [math] = parsePatch(PATCH)
    const firstAdd = math?.lines.find((line) => line.kind === 'add')
    expect(firstAdd).toMatchObject({ newNumber: 4, oldNumber: null })
    const context = math?.lines.find((line) => line.kind === 'context')
    expect(context).toMatchObject({
      oldNumber: 1,
      newNumber: 1,
      text: 'export function add(a, b) {',
    })
  })
})
