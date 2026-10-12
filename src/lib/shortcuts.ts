/**
 * True when a keystroke belongs to a text field or an open overlay, not to app shortcuts.
 * `ownLayer` names an attribute (e.g. `data-wo-sheet`) marking the caller's own sheet,
 * which then doesn't count as an overlay.
 */
export function isTypingTarget(target: EventTarget | null, ownLayer?: string): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const layer = target.closest(
    '[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"]',
  )
  return layer !== null && (ownLayer === undefined || !layer.hasAttribute(ownLayer))
}

/** J/K walk a board's cards (`selector`) in reading order; Enter opens (native button). */
export function moveCardFocus(selector: string, step: 1 | -1): void {
  const cards = [...document.querySelectorAll<HTMLElement>(selector)]
  if (cards.length === 0) return
  const index = cards.findIndex((card) => card === document.activeElement)
  const next = index === -1 ? (step === 1 ? 0 : cards.length - 1) : index + step
  const card = cards[Math.max(0, Math.min(cards.length - 1, next))]
  card?.focus()
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
