// Pure: the Files tab's keyboard moves (j/k files, v next unviewed, n/p threads, c comment).

/** j/k: the file `step` away from `current` in tree order, clamped to the ends. */
export function stepFile(
  order: readonly string[],
  current: string | undefined,
  step: 1 | -1,
): string | undefined {
  const index = current === undefined ? -1 : order.indexOf(current)
  return order[Math.max(0, Math.min(order.length - 1, index + step))]
}

/** v: after marking `current` viewed, the next unviewed file in tree order, wrapping around. */
export function nextUnviewed(
  order: readonly string[],
  current: string | undefined,
  files: readonly { path: string; viewed: boolean }[],
): string | undefined {
  const index = current === undefined ? -1 : order.indexOf(current)
  const rest = [...order.slice(index + 1), ...order.slice(0, index)]
  return rest.find((path) => files.find((f) => f.path === path)?.viewed === false)
}

/** n/p: the next or previous thread on a line, in line order, wrapping around. */
export function cycleThread(
  threads: readonly { id: string; line: number | null }[],
  current: string | undefined,
  step: 1 | -1,
): string | undefined {
  const ids = threads
    .filter((t) => t.line !== null)
    .toSorted((a, b) => (a.line ?? 0) - (b.line ?? 0))
    .map((t) => t.id)
  if (ids.length === 0) return undefined
  const at = current === undefined ? -1 : ids.indexOf(current)
  return step === 1 ? ids[(at + 1) % ids.length] : ids[(at - 1 + ids.length) % ids.length]
}

/** c: a focused-line key (`RIGHT12`, `LEFT3`) as a comment target. */
export function parseLineKey(key: string): { side: 'LEFT' | 'RIGHT'; line: number } | null {
  const match = /^(LEFT|RIGHT)(\d+)$/.exec(key)
  if (match === null) return null
  return { side: match[1] === 'LEFT' ? 'LEFT' : 'RIGHT', line: Number(match[2]) }
}
