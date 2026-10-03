/** S/M/L/XL by lines changed (<50, <250, <1000, else), like GitHub size labels. */
export type PrSize = 'S' | 'M' | 'L' | 'XL'

export function prSize(additions: number, deletions: number): PrSize {
  const lines = additions + deletions
  if (lines < 50) return 'S'
  if (lines < 250) return 'M'
  if (lines < 1000) return 'L'
  return 'XL'
}

/** "+120 −8", for the size chip's tooltip. */
export function sizeLabel(additions: number, deletions: number): string {
  return `+${additions} −${deletions}`
}
